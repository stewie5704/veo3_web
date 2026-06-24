import uuid
from datetime import datetime
from sqlalchemy import String, Integer, DateTime, Text, Enum, ForeignKey, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column
import enum
from app.database import Base


class SceneStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    idea: Mapped[str | None] = mapped_column(Text, nullable=True)
    style: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_key: Mapped[str] = mapped_column(String(100), default="veo_3_1_t2v_lite_low_priority")
    aspect_ratio: Mapped[str] = mapped_column(String(10), default="16:9")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=8)
    language: Mapped[str] = mapped_column(String(10), default="vi")
    scene_count: Mapped[int] = mapped_column(Integer, default=0)
    # chain mode — each scene uses last frame of previous as start image
    chain_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    # Auto lồng tiếng Việt: TTS đọc thoại từng cảnh rồi ghép vào video
    voiceover: Mapped[bool] = mapped_column(Boolean, default=False)
    voice: Mapped[str] = mapped_column(String(40), default="Kore")
    # auto-merge result
    merged_file: Mapped[str | None] = mapped_column(String(300), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    narration: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[SceneStatus] = mapped_column(Enum(SceneStatus), default=SceneStatus.pending)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    video_file: Mapped[str | None] = mapped_column(String(300), nullable=True)
    model_key: Mapped[str] = mapped_column(String(100), default="veo_3_1_t2v_lite_low_priority")
    aspect_ratio: Mapped[str] = mapped_column(String(10), default="16:9")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=8)
    # I2V: start image (local file path relative to UPLOAD_PATH)
    start_image: Mapped[str | None] = mapped_column(String(300), nullable=True)
    # Chain: wait for previous scene to complete before rendering
    wait_for_prev: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
