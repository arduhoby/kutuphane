from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, func
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(100))
    is_admin = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)

    # AI sağlayıcı ayarları — varsayılan "local" (yerel Llama). Kullanıcı kendi
    # Claude API anahtarını girerse görevler Claude'a yönlendirilir.
    ai_provider = Column(String(20), default="local", server_default="local")
    ai_model = Column(String(100), nullable=True)
    claude_api_key_enc = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
