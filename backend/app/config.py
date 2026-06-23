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

    class Config:
        env_file = ".env"


settings = Settings()
UPLOAD_PATH = Path(settings.upload_dir)
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
