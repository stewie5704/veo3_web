import os
import secrets
from pydantic_settings import BaseSettings, SettingsConfigDict
from pathlib import Path


_DEFAULT_SECRET = "change-me-to-random-64-char-string"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).parent.parent / ".env"),
        extra="ignore",
    )

    # Database
    database_url: str = "sqlite+aiosqlite:///./veo3web.db"

    # JWT — DEV default fills một secret ngẫu nhiên tại tiến trình (mất khi restart, buộc dev tự đặt).
    # PROD (APP_ENV=production) BẮT BUỘC set SECRET_KEY trong .env — nếu thiếu sẽ raise ở dưới.
    secret_key: str = _DEFAULT_SECRET
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

    # Email (Resend) — xác minh email khi đăng ký. Key/from đặt trong .env.
    resend_api_key: str = ""
    email_from: str = "AI AutoCut <no-reply@aiautocut.com>"
    email_verify_required: bool = False   # True = bắt buộc xác minh email mới tạo được video

    # 9Router Fallback config
    system_9router_url: str = "http://127.0.0.1:20128/v1"
    system_9router_key: str = "sk-dummy"
    system_9router_models: str = "gemini-2.5-flash"

settings = Settings()

# Bảo vệ SECRET_KEY: PROD phải có riêng; DEV thì tự sinh ephemeral để không ai vô tình
# ký JWT bằng chuỗi mặc định public trong repo.
_app_env = (os.getenv("APP_ENV") or os.getenv("ENV") or "").lower()
if settings.secret_key == _DEFAULT_SECRET:
    if _app_env in ("prod", "production"):
        raise ValueError(
            "SECRET_KEY chưa được đặt trong .env (đang là giá trị mặc định public). "
            "Sinh 1 chuỗi ngẫu nhiên >= 64 ký tự và đặt vào backend/.env trước khi chạy prod."
        )
    # DEV: sinh ngẫu nhiên tại runtime — không bao giờ đi ra ngoài process.
    settings.secret_key = secrets.token_urlsafe(64)

UPLOAD_PATH = Path(settings.upload_dir)
UPLOAD_PATH.mkdir(parents=True, exist_ok=True)
