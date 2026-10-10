"""
translate.py (router)
---------------------
Metin çeviri endpoint'i. Aktif LLM sağlayıcısını kullanır: kullanıcı Claude
anahtarı girdiyse Claude, aksi halde yerel Llama 3.2 3B.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.llm_service import ask_llm

router = APIRouter(prefix="/translate", tags=["translate"])

MAX_CHARS = 20000


class TranslateRequest(BaseModel):
    text: str
    target_lang: str = "Türkçe"
    source_lang: Optional[str] = None


@router.post("")
async def translate(
    data: TranslateRequest,
    current_user: User = Depends(get_current_user),
):
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Çevrilecek metin boş")
    if len(text) > MAX_CHARS:
        raise HTTPException(status_code=400, detail=f"Metin çok uzun (maks {MAX_CHARS} karakter)")

    target = (data.target_lang or "Türkçe").strip()
    src = f"Kaynak dil: {data.source_lang}. " if data.source_lang else "Kaynak dili otomatik algıla. "

    prompt = [
        {
            "role": "system",
            "content": (
                f"Sen profesyonel bir çevirmensin. {src}"
                f"Verilen metni {target} diline çevir.\n"
                "Kurallar:\n"
                "- Anlamı ve tonu koru, akıcı ve doğal bir çeviri yap.\n"
                "- Terimleri bağlama uygun çevir.\n"
                "- Sadece çeviriyi döndür; açıklama, not veya orijinal metni ekleme."
            ),
        },
        {"role": "user", "content": text},
    ]

    try:
        translation = await ask_llm(prompt, user=current_user, max_tokens=4096, temperature=0.3)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Çeviri başarısız: {str(e)[:200]}")

    return {"translation": translation, "target_lang": target, "source_lang": data.source_lang}
