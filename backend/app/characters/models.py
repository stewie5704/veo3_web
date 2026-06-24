import uuid
from datetime import datetime
from sqlalchemy import String, DateTime, Text, func
from sqlalchemy.orm import Mapped, mapped_column
from app.database import Base


class Character(Base):
    """Named character with face reference image for face-locking."""
    __tablename__ = "characters"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    # NULL = nhân vật ở "kho chung" (tái sử dụng mọi project). Có giá trị = thuộc riêng 1 project.
    project_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    image_file: Mapped[str] = mapped_column(String(300), nullable=False)  # filename in /images/chars/
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
