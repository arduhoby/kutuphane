"""
claude_service.py
-----------------
Anthropic Claude (Messages API) istemcisi.

Kullanıcı kendi API anahtarını girdiğinde tüm AI görevleri (çeviri, OCR
düzeltme, özetleme, sohbet, münazara) bu servis üzerinden Claude'a yönlendirilir.

OpenAI tarzı mesaj listesi ([{"role": "system"|"user"|"assistant", ...}]) alır,
Anthropic formatına dönüştürür ve düz metin yanıt döner — böylece
llm_service.ask_llm() ile aynı arayüzü sunar.
"""

import logging
from typing import Optional

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


def _to_anthropic_messages(messages: list[dict]) -> tuple[list[dict], str]:
    """OpenAI tarzı mesajları (messages, system) ikilisine dönüştürür."""
    system_parts = [m.get("content", "") for m in messages if m.get("role") == "system"]
    system = "\n\n".join(p for p in system_parts if p)

    convo: list[dict] = []
    for m in messages:
        if m.get("role") == "system":
            continue
        role = "assistant" if m.get("role") == "assistant" else "user"
        content = m.get("content", "")
        if convo and convo[-1]["role"] == role:
            convo[-1]["content"] += "\n\n" + content
        else:
            convo.append({"role": role, "content": content})

    # Anthropic ilk mesajın "user" olmasını bekler.
    if not convo or convo[0]["role"] != "user":
        convo.insert(0, {"role": "user", "content": "Lütfen yanıtla."})

    return convo, system


async def ask_claude(
    messages: list[dict],
    api_key: str,
    model: Optional[str] = None,
    max_tokens: int = 1024,
    temperature: float = 0.7,
    **kwargs,
) -> str:
    """Claude Messages API üzerinden sohbet tamamlama. Düz metin döner."""
    if not api_key:
        raise ValueError("Claude API anahtarı gerekli")

    model = model or settings.CLAUDE_DEFAULT_MODEL
    convo, system = _to_anthropic_messages(messages)

    payload: dict = {
        "model": model,
        "max_tokens": max(max_tokens or settings.CLAUDE_MAX_TOKENS, 256),
        "temperature": max(0.0, min(1.0, temperature)),
        "messages": convo,
    }
    if system:
        payload["system"] = system

    headers = {
        "x-api-key": api_key,
        "anthropic-version": settings.CLAUDE_API_VERSION,
        "content-type": "application/json",
    }

    url = f"{settings.CLAUDE_API_BASE}/v1/messages"
    async with httpx.AsyncClient(timeout=settings.CLAUDE_TIMEOUT_SECONDS) as client:
        resp = await client.post(url, json=payload, headers=headers)

    if resp.status_code != 200:
        detail = ""
        try:
            detail = resp.json().get("error", {}).get("message", "")
        except Exception:
            detail = resp.text[:300]
        logger.error(f"[CLAUDE] API hatası {resp.status_code}: {detail}")
        raise RuntimeError(f"Claude API hatası ({resp.status_code}): {detail or 'bilinmeyen hata'}")

    data = resp.json()
    text = "".join(
        block.get("text", "")
        for block in data.get("content", [])
        if block.get("type") == "text"
    )
    return text.strip()


async def test_claude_key(api_key: str, model: Optional[str] = None) -> str:
    """Anahtarı doğrulamak için küçük bir test çağrısı yapar."""
    return await ask_claude(
        [{"role": "user", "content": "Merhaba! Tek kelimeyle yanıt ver: 'çalışıyor'."}],
        api_key=api_key,
        model=model,
        max_tokens=32,
        temperature=0.0,
    )
