import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class UserSession(Base):
    """Tracks active Extension WebSocket connections per user."""
    __tablename__ = "user_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    connected_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_seen: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    # Latest captcha token sent by extension
    captcha_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    captcha_expires: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
