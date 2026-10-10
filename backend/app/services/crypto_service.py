"""
crypto_service.py
-----------------
Kullanıcıların girdiği Claude API anahtarlarını veritabanında düz metin olarak
saklamamak için SECRET_KEY'ten türetilen simetrik anahtarla şifreler.

Fernet (AES-128-CBC + HMAC) kullanır. Anahtar SECRET_KEY'ten SHA-256 ile
türetilir; yani SECRET_KEY değişirse eski kayıtlar çözülemez.
"""

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

logger = logging.getLogger(__name__)


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt(plain: str) -> str:
    """Düz metni şifreli token'a çevirir."""
    if not plain:
        return ""
    return _fernet().encrypt(plain.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str:
    """Şifreli token'ı düz metne çevirir. Başarısızsa boş string döner."""
    if not token:
        return ""
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except (InvalidToken, Exception) as e:
        logger.warning(f"[CRYPTO] Şifre çözme başarısız: {e}")
        return ""


def mask_key(key: str) -> str:
    """API anahtarını loglarda/UI'da güvenli göstermek için maskeler."""
    if not key:
        return ""
    if len(key) <= 12:
        return "•" * len(key)
    return f"{key[:7]}…{key[-4:]}"
