"""
ai_status.py
------------
AI model durumunu sorgulayan endpoint.
Frontend, model yüklenirken bu endpoint'i polling yaparak banner gösterir.
"""

from fastapi import APIRouter, Depends
from typing import Optional
from app.models.user import User
from app.services.llm_service import get_llm_status, get_active_provider
from app.services.embed_service import get_embed_status
from app.services.auth_service import get_optional_user

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/status")
async def ai_status(current_user: Optional[User] = Depends(get_optional_user)):
    """
    AI model yükleme durumunu döndürür.
    Frontend bu bilgiyi kullanarak yükleme banner'ı gösterir.

    Yanıt:
      llm_loaded   : bool  — yerel LLM (Llama 3.2 3B) RAM'de mi?
      llm_loading  : bool  — yerel LLM şu an yükleniyor mu?
      embed_loaded : bool  — Embedding modeli RAM'de mi?
      provider     : str   — aktif sağlayıcı ("local" | "claude")
    """
    llm = get_llm_status()
    embed = get_embed_status()
    return {
        "llm_loaded": llm["loaded"],
        "llm_loading": llm["loading"],
        "embed_loaded": embed["loaded"],
        "provider": get_active_provider(current_user),
    }
