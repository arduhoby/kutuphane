"""
settings.py (router)
--------------------
Kullanıcının kendi AI ayarlarını yönettiği self-servis endpoint'ler.

- GET  /api/settings/ai        → mevcut ayarlar (anahtar maskeli)
- PUT  /api/settings/ai        → sağlayıcı / model / API anahtarı kaydet
- POST /api/settings/ai/test   → anahtarı canlı doğrula
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.crypto_service import encrypt, decrypt, mask_key
from app.services.claude_service import test_claude_key

router = APIRouter(prefix="/settings", tags=["settings"])

VALID_PROVIDERS = {"local", "claude"}


class AISettingsUpdate(BaseModel):
    provider: Optional[str] = None
    model: Optional[str] = None
    api_key: Optional[str] = None  # boş string → anahtarı sil (local'e döner)


class AITestRequest(BaseModel):
    api_key: Optional[str] = None
    model: Optional[str] = None


def _serialize(user: User) -> dict:
    key = decrypt(user.claude_api_key_enc or "")
    return {
        "provider": user.ai_provider or "local",
        "model": user.ai_model or settings.CLAUDE_DEFAULT_MODEL,
        "has_key": bool(key),
        "key_masked": mask_key(key),
        "default_model": settings.CLAUDE_DEFAULT_MODEL,
    }


@router.get("/ai")
async def get_ai_settings(current_user: User = Depends(get_current_user)):
    return _serialize(current_user)


@router.put("/ai")
async def update_ai_settings(
    data: AISettingsUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if data.provider is not None:
        if data.provider not in VALID_PROVIDERS:
            raise HTTPException(status_code=400, detail="Geçersiz sağlayıcı")
        current_user.ai_provider = data.provider

    if data.model is not None:
        current_user.ai_model = data.model.strip() or None

    if data.api_key is not None:
        clean = data.api_key.strip()
        current_user.claude_api_key_enc = encrypt(clean) if clean else None

    # claude seçildiyse geçerli bir anahtar olmalı
    key = decrypt(current_user.claude_api_key_enc or "")
    if (current_user.ai_provider or "local") == "claude" and not key:
        raise HTTPException(status_code=400, detail="Claude için API anahtarı gerekli")

    await db.commit()
    await db.refresh(current_user)
    return _serialize(current_user)


@router.post("/ai/test")
async def test_ai_settings(
    data: AITestRequest,
    current_user: User = Depends(get_current_user),
):
    key = (data.api_key or "").strip() or decrypt(current_user.claude_api_key_enc or "")
    if not key:
        raise HTTPException(status_code=400, detail="Test için API anahtarı gerekli")
    model = (data.model or current_user.ai_model or settings.CLAUDE_DEFAULT_MODEL)
    try:
        reply = await test_claude_key(key, model=model)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Bağlantı başarısız: {str(e)[:200]}")
    return {"ok": True, "model": model, "reply": reply[:200]}
