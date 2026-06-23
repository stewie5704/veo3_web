import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), index=True, nullable=False)
    plan: Mapped[str] = mapped_column(String(20), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)        # VND (no decimals)
    currency: Mapped[str] = mapped_column(String(8), default="VND")
    gateway: Mapped[str] = mapped_column(String(20), default="")        # vnpay / momo / stripe
    status: Mapped[str] = mapped_column(String(12), default="pending")  # pending / paid / failed
    gateway_ref: Mapped[str | None] = mapped_column(String(120), nullable=True)  # txn id from gateway
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
