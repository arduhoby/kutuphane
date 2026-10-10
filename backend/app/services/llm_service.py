"""
llm_service.py
--------------
Çoklu sağlayıcılı LLM yönlendirici.

Varsayılan sağlayıcı yerel Llama 3.2 3B (GGUF, llama-cpp-python) — Lazy Load +
10 dk TTL. Kullanıcı kendi Claude API anahtarını girdiyse görevler Anthropic
Claude (Haiku) üzerinden yürütülür.

Dışa açılan arayüz:
  ask_llm(messages, user=...)  → str
  build_prompt(...)            → list[dict]
  get_llm_status()             → dict {"loaded": bool, "loading": bool}
  resolve_llm_config(user)     → {"provider": "local"|"claude", ...}
"""

import asyncio
import logging
import os
import threading
import concurrent.futures
from typing import Optional

from app.config import settings

logger = logging.getLogger(__name__)
# ---------------------------------------------------------------------------
# Dahili durum (yerel model)
# ---------------------------------------------------------------------------
_llm = None                    # llama_cpp.Llama nesnesi (yüklüyse)
_llm_lock = asyncio.Lock()     # eş zamanlı yüklemeyi önler
_inference_lock = asyncio.Lock() # eş zamanlı LLM çıkarımını (inference) önler
_loading = False               # yükleme devam ediyor mu?
_last_used: float = 0.0        # son kullanım zamanı (time.monotonic)
_ttl_task: Optional[asyncio.Task] = None  # TTL sayaç görevi

# LLM'in çalıştığı Apple Metal (GPU) işlemleri, farklı thread'lere (iş parçacıklarına) 
# geçtiğinde bellek referanslarını kaybedip "Abort trap: 6" hatası verir.
# Bu nedenle tüm LLM işlemlerini tek bir sabit thread'e hapsediyoruz.
_llm_executor = concurrent.futures.ThreadPoolExecutor(max_workers=1, thread_name_prefix="llm_metal_worker")


def _is_loaded() -> bool:
    return _llm is not None


def get_llm_status() -> dict:
    return {"loaded": _is_loaded(), "loading": _loading}


# ---------------------------------------------------------------------------
# Sağlayıcı yönlendirme (local | claude)
# ---------------------------------------------------------------------------
def resolve_llm_config(user) -> dict:
    """
    Kullanıcının AI ayarlarına göre hangi sağlayıcının kullanılacağını belirler.
    Kullanıcı Claude seçmiş VE geçerli bir anahtar varsa Claude; aksi halde local.
    """
    if user is None:
        return {"provider": "local"}

    provider = (getattr(user, "ai_provider", None) or "local").lower()
    if provider == "claude":
        from app.services.crypto_service import decrypt

        key = decrypt(getattr(user, "claude_api_key_enc", None) or "")
        if not key:
            key = settings.CLAUDE_API_KEY  # global/fallback anahtar
        if key:
            return {
                "provider": "claude",
                "api_key": key,
                "model": getattr(user, "ai_model", None) or settings.CLAUDE_DEFAULT_MODEL,
            }
        logger.warning("[LLM] provider=claude ama geçerli anahtar yok → local'e düşülüyor.")

    return {"provider": "local"}


def get_active_provider(user) -> str:
    return resolve_llm_config(user)["provider"]


# ---------------------------------------------------------------------------
# TTL: 10 dk kullanım yoksa bellekten boşalt
# ---------------------------------------------------------------------------
def _unload_model_sync():
    """Modeli güvenli bir şekilde worker thread üzerinde bellekten boşaltır."""
    global _llm
    if _llm is not None:
        _llm = None

async def _ttl_watchdog():
    """Her 60 sn'de bir kontrol eder; TTL dolmuşsa modeli boşaltır."""
    import time
    global _last_used, _ttl_task
    while True:
        await asyncio.sleep(60)
        if _llm is None:
            break
        idle = time.monotonic() - _last_used
        if idle >= settings.LLM_TTL_SECONDS:
            logger.info(
                f"[LLM] {idle:.0f} sn kullanım yok → model bellekten boşaltılıyor."
            )
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(_llm_executor, _unload_model_sync)
            _ttl_task = None
            break


def _start_ttl_watchdog():
    global _ttl_task
    if _ttl_task is None or _ttl_task.done():
        loop = asyncio.get_event_loop()
        _ttl_task = loop.create_task(_ttl_watchdog())


# ---------------------------------------------------------------------------
# Model yükleme (senkron, thread'de çalışır)
# ---------------------------------------------------------------------------
def _load_model_sync():
    """llama_cpp.Llama nesnesini oluşturur. asyncio.run_in_executor ile çağrılır."""
    from llama_cpp import Llama

    model_path = settings.LLM_MODEL_PATH
    if not os.path.isfile(model_path):
        raise FileNotFoundError(
            f"GGUF model dosyası bulunamadı: {model_path}\n"
            "Lütfen modeli indirin: "
            "huggingface-cli download bartowski/Llama-3.2-3B-Instruct-GGUF "
            "Llama-3.2-3B-Instruct-Q4_K_M.gguf --local-dir ./models"
        )

    logger.info(f"[LLM] Model yükleniyor: {model_path}")
    llm = Llama(
        model_path=model_path,
        n_ctx=settings.LLM_N_CTX,
        n_threads=settings.LLM_N_THREADS,
        n_gpu_layers=settings.LLM_N_GPU_LAYERS,  # -1 = tüm katmanlar Metal GPU
        verbose=False,
    )
    logger.info("[LLM] Model yüklendi ✓")
    return llm


# ---------------------------------------------------------------------------
# Ana yükleme fonksiyonu (async, lock ile korumalı)
# ---------------------------------------------------------------------------
async def _ensure_loaded() -> None:
    """Gerekirse modeli yükler. Aynı anda sadece bir yükleme yapılır."""
    global _llm, _loading

    if _llm is not None:
        return

    async with _llm_lock:
        if _llm is not None:  # başka coroutine yüklemişse
            return
        _loading = True
        logger.info("[LLM] Lazy yükleme başlatıldı.")
        try:
            loop = asyncio.get_event_loop()
            # ÖNEMLİ: Her zaman sabit LLM executor kullanılarak Metal thread-safe sağlanır.
            _llm = await loop.run_in_executor(_llm_executor, _load_model_sync)
            _start_ttl_watchdog()
        finally:
            _loading = False


# ---------------------------------------------------------------------------
# Çıkarım (inference)
# ---------------------------------------------------------------------------
def _run_chat_sync(messages: list[dict], max_tokens: int, temperature: float) -> str:
    """llama_cpp chat_completion çağrısı — thread'de çalışır."""
    import time
    global _last_used
    _last_used = time.monotonic()

    output = _llm.create_chat_completion(
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
        stream=False,
    )
    return output["choices"][0]["message"]["content"]


async def ask_llm(
    messages: list[dict],
    max_tokens: int = 1024,
    temperature: float = 0.7,
    user=None,
    **kwargs,
) -> str:
    """
    Sohbet tamamlama. Kullanıcı Claude anahtarı girdiyse Claude'a, aksi halde
    yerel Llama 3.2 3B'ye yönlendirir.
    """
    cfg = resolve_llm_config(user)
    if cfg["provider"] == "claude":
        from app.services.claude_service import ask_claude

        # Küçük max_tokens değerleri Claude çıktısını kesmesin; makul bir alt sınır uygula.
        claude_max_tokens = max_tokens if max_tokens and max_tokens >= 256 else settings.CLAUDE_MAX_TOKENS
        return await ask_claude(
            messages,
            api_key=cfg["api_key"],
            model=cfg["model"],
            max_tokens=claude_max_tokens,
            temperature=temperature,
        )

    await _ensure_loaded()

    loop = asyncio.get_event_loop()
    async with _inference_lock:
        try:
            # ÖNEMLİ: Her zaman yüklemenin yapıldığı aynı thread üzerinden inference çalıştırılır
            result = await loop.run_in_executor(
                _llm_executor, _run_chat_sync, messages, max_tokens, temperature
            )
            return result
        except Exception as e:
            logger.error(f"[LLM] Çıkarım hatası: {e}")
            raise


# ---------------------------------------------------------------------------
# Prompt builder (ollama_service'den taşındı)
# ---------------------------------------------------------------------------
def build_prompt(
    book_title: str,
    book_author: Optional[str],
    user_message: str,
    web_context: str = "",
) -> list[dict]:
    system = f"""Sen bir kitap tartışma asistanısın. Kullanıcı "{book_title}" kitabı hakkında konuşuyor.
Yazar: {book_author or 'Bilinmiyor'}

KURALLAR (kesinlikle uy):
- Sadece kitap hakkında konuş. Konu dışına çıkma.
- Web'den gelen bilgileri kullan. Web'de bilgi varsa yanıtının sonunda mutlaka bu formatta kaynak göster:

   Kaynak:
   [başlık](link)
   [başlık](link)

- Web'de bilgi bulamadıysan "Bu kitap hakkında bilgi bulamadım" de. Asla uydurma.
- Kısa ve doğrudan cevap ver. 3-4 cümle yeter.
- Kullanıcı konuyu değiştirmeye çalışırsa "Bu kitap dışında konuşamıyorum" de."""

    messages = [{"role": "system", "content": system}]

    if web_context:
        messages.append({
            "role": "system",
            "content": f"Web'de bulunan kaynaklar (kullanırken linki göster):\n{web_context}",
        })

    messages.append({"role": "user", "content": user_message})
    return messages
