import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)        # VND (no decimals)
    currency: Mapped[str] = mapped_column(String(8), default="VND")
    gateway: Mapped[str] = mapped_column(String(20), default="")        # payos / binance / manual
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending / paid / failed
    gateway_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)  # txn id or order code
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    expires_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)  # 5-min order window
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class Commission(Base):
    """Affiliate earning created when a referred user's payment is confirmed paid.
    2 tầng: level=1 (F1 trực tiếp, % theo bậc) + level=2 (F2 gián tiếp, 5%). Mỗi đơn tối đa
    1 hoa hồng MỖI tầng -> unique (payment_id, level) (index tạo ở _lightweight_migrate)."""
    __tablename__ = "commissions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    affiliate_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    referred_user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    payment_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)  # KHÔNG unique đơn lẻ nữa (xem level)
    level: Mapped[int] = mapped_column(Integer, nullable=False, default=1)  # 1 = F1 trực tiếp, 2 = F2 gián tiếp
    amount: Mapped[int] = mapped_column(Integer, nullable=False)   # VND
    rate: Mapped[int] = mapped_column(Integer, nullable=False)     # % applied
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending / paid
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class WalletTxn(Base):
    """Ledger of every wallet movement (VND). Withdrawals carry status pending/done/rejected."""
    __tablename__ = "wallet_txns"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)   # signed VND effect on balance
    kind: Mapped[str] = mapped_column(String(16), nullable=False)  # commission|topup|withdraw|renew|refund|adjust
    status: Mapped[str] = mapped_column(String(12), default="done")  # done|pending|rejected (withdrawals)
    note: Mapped[str | None] = mapped_column(Text, nullable=True)   # bank info / context
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    processed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)


class AssistantGift(Base):
    """Tracks AI-assistant bundles gifted to users on first purchase. One record per user."""
    __tablename__ = "assistant_gifts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False, unique=True)
    payment_id: Mapped[str] = mapped_column(String(36), nullable=False)
    count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assistants_json: Mapped[str] = mapped_column(Text, default="[]")   # JSON array of assistant objects
    gifted_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
