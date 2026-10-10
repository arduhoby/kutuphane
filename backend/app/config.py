import os
from pydantic_settings import BaseSettings

_BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://kutuphane:kutuphane@localhost:5432/kutuphane"
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    COVERS_DIR: str = os.path.join(_BACKEND_DIR, "covers")
    EBOOKS_DIR: str = os.path.join(_BACKEND_DIR, "ebooks")
    GOOGLE_API_KEY: str = ""

    # -----------------------------------------------------------------------
    # Yerel AI — Llama 3.2 3B (llama-cpp-python, Apple Metal GPU)
    # -----------------------------------------------------------------------
    # Model dosyası: backend/models/Llama-3.2-3B-Instruct-Q4_K_M.gguf
    LLM_MODEL_PATH: str = os.path.join(_BACKEND_DIR, "models", "Llama-3.2-3B-Instruct-Q4_K_M.gguf")
    LLM_TTL_SECONDS: int = 600       # 10 dk kullanım yoksa model bellekten düşer
    LLM_N_CTX: int = 4096            # bağlam penceresi (token)
    LLM_N_THREADS: int = 4           # CPU iş parçacığı sayısı
    LLM_N_GPU_LAYERS: int = -1       # -1 = tüm katmanlar Metal GPU'ya yükle

    # -----------------------------------------------------------------------
    # Claude API (Anthropic) — Kullanıcı kendi API anahtarını girerse kullanılır
    # -----------------------------------------------------------------------
    CLAUDE_API_BASE: str = "https://api.anthropic.com"
    CLAUDE_API_VERSION: str = "2023-06-01"
    CLAUDE_DEFAULT_MODEL: str = "claude-3-5-haiku-latest"
    CLAUDE_MAX_TOKENS: int = 2048
    CLAUDE_TIMEOUT_SECONDS: int = 120
    # Admin/global yedek anahtar (opsiyonel). Kullanıcı anahtarı yoksa bu kullanılır.
    CLAUDE_API_KEY: str = ""

    class Config:
        env_file = ".env"


settings = Settings()
os.makedirs(settings.COVERS_DIR, exist_ok=True)
os.makedirs(settings.EBOOKS_DIR, exist_ok=True)
os.makedirs(os.path.join(_BACKEND_DIR, "models"), exist_ok=True)

