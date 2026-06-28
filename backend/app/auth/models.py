import uuid
from datetime import datetime
from sqlalchemy import String, Boolean, DateTime, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
    username: Mapped[str] = mapped_column(String(100), unique=True, index=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    is_banned: Mapped[bool] = mapped_column(Boolean, default=False)

    # Google Ultra
    google_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    google_cookies: Mapped[str | None] = mapped_column(String(8192), nullable=True)
    google_project_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    gemini_api_key: Mapped[str | None] = mapped_column(String(200), nullable=True)
    has_gemini_key: Mapped[bool] = mapped_column(Boolean, default=False)

    # Quota & usage
    quota_videos: Mapped[int] = mapped_column(Integer, default=100)  # -1 = unlimited
    videos_generated: Mapped[int] = mapped_column(Integer, default=0)
    images_generated: Mapped[int] = mapped_column(Integer, default=0)

    # Subscription (time-based plan): active = plan != 'free' AND plan_expires_at > now
    plan: Mapped[str] = mapped_column(String(20), default="free")
    plan_expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Profile
    display_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(300), nullable=True)

    # Affiliate / referral
    referral_code: Mapped[str | None] = mapped_column(String(16), unique=True, index=True, nullable=True)
    referred_by: Mapped[str | None] = mapped_column(String(36), index=True, nullable=True)  # affiliate user id
    is_affiliate: Mapped[bool] = mapped_column(Boolean, default=True)   # mọi user đều là affiliate
    affiliate_rate: Mapped[int] = mapped_column(Integer, default=10)    # commission %, dùng khi locked
    affiliate_rate_locked: Mapped[bool] = mapped_column(Boolean, default=False)  # admin đặt tay -> khóa, không auto lên bậc
    wallet_balance: Mapped[int] = mapped_column(Integer, default=0)     # số dư ví (VND); hiển thị T coin = /10000
    auto_renew: Mapped[bool] = mapped_column(Boolean, default=False)    # tự gia hạn gói từ ví

    # Xác minh email (Resend): user cũ được grandfather = True trong _lightweight_migrate
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verify_code: Mapped[str | None] = mapped_column(String(8), nullable=True)
    email_verify_sent_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_login: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
