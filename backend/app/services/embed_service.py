"""
embed_service.py
----------------
sentence-transformers ile all-MiniLM-L6-v2 embedding modeli.

16 GB RAM'de 90 MB ihmal edilebilir → model kalıcı yüklü tutulur.
İlk çağrıda HuggingFace cache'inden otomatik yüklenir.

Dışa açılan arayüz:
  get_embedding(text)  → list[float] | None
"""

import asyncio
import logging
from typing import Optional

logger = logging.getLogger(__name__)

_model = None
_model_lock = asyncio.Lock()

EMBED_MODEL_NAME = "all-MiniLM-L6-v2"


def _load_embed_sync():
    from sentence_transformers import SentenceTransformer
    logger.info(f"[EMBED] '{EMBED_MODEL_NAME}' modeli yükleniyor...")
    m = SentenceTransformer(EMBED_MODEL_NAME)
    logger.info("[EMBED] Embedding modeli yüklendi ✓")
    return m


async def _ensure_embed_loaded() -> None:
    global _model
    if _model is not None:
        return
    async with _model_lock:
        if _model is not None:
            return
        loop = asyncio.get_event_loop()
        _model = await loop.run_in_executor(None, _load_embed_sync)


def _embed_sync(text: str) -> list[float]:
    """Model üzerinde senkron encode — run_in_executor ile çağrılır."""
    vec = _model.encode(text[:3000], normalize_embeddings=True)
    return vec.tolist()


async def get_embedding(text: str) -> Optional[list[float]]:
    """
    Metni vektöre çevirir.
    Eski generate_embedding() ile birebir uyumlu arayüz.
    """
    try:
        await _ensure_embed_loaded()
        loop = asyncio.get_event_loop()
        return await loop.run_in_executor(None, _embed_sync, text)
    except Exception as e:
        logger.error(f"[EMBED] Embedding hatası: {e}")
        return None


def get_embed_status() -> dict:
    return {"loaded": _model is not None}
