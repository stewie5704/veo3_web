from pydantic_settings import BaseSettings
from pathlib import Path


class Settings(BaseSettings):
    # Database
    database_url: str = "sqlite+aiosqlite:///./veo3web.db"

    # JWT
    secret_key: str = "change-me-to-random-64-char-string"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 1440  # 24h

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # Storage
    upload_dir: str = "../uploads/videos"
    max_video_size_mb: int = 200

    # CORS — frontend_url + any extra prod origins (comma-separated), e.g.
    # "https://app.veo3studio.com,https://veo3studio.com"
    frontend_url: str = "http://localhost:5173"
    cors_origins: str = ""

    # Admin
    admin_email: str = "admin@yourdomain.com"
    admin_password: str = "change-me"

    # PayOS (banking VN)
    payos_client_id: str = ""
    payos_api_key: str = ""
    payos_checksum_key: str = ""

    # Binance Pay (USDT)
    binance_api_key: str = ""
    binance_secret_key: str = ""
    usdt_vnd_rate: int = 26000   # approximate; update in .env when rate shifts

    # Video output upscale: hybrid (Flow real-HD then ffmpeg fallback) | flow | ffmpeg | off
    upscale_mode: str = "hybrid"

    class Config:
        env_file = ".env"


settings = Settings()
UPLOAD_PATH = Path(settings.upload_dir)
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
