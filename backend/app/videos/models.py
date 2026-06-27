import uuid
from datetime import datetime
from sqlalchemy import String, Integer, Float, Boolean, DateTime, Text, Enum, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column
import enum
from app.database import Base


class JobStatus(str, enum.Enum):
    pending = "pending"
    processing = "processing"
    done = "done"
    failed = "failed"


class VideoJob(Base):
    __tablename__ = "video_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)

    # Input
    prompt: Mapped[str] = mapped_column(Text, nullable=False)
    aspect_ratio: Mapped[str] = mapped_column(String(10), default="16:9")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=8)
    count: Mapped[int] = mapped_column(Integer, default=1)
    model_key: Mapped[str] = mapped_column(String(100), default="veo_3_1_t2v_lite_low_priority")
    # Tool lẻ: I2V (ảnh khung đầu) / R2V (ảnh tham chiếu giữ mặt) — đường dẫn tuyệt đối
    start_image: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ref_images: Mapped[str | None] = mapped_column(Text, nullable=True)   # JSON list path

    # Status
    status: Mapped[JobStatus] = mapped_column(Enum(JobStatus), default=JobStatus.pending)
    error_msg: Mapped[str | None] = mapped_column(Text, nullable=True)
    progress: Mapped[int] = mapped_column(Integer, default=0)  # 0-100

    # Output — list of video file paths (JSON array stored as text)
    output_files: Mapped[str | None] = mapped_column(Text, nullable=True)  # JSON: ["path1","path2"]
    thumbnails: Mapped[str | None] = mapped_column(Text, nullable=True)    # JSON: ["thumb1","thumb2"]
    hd: Mapped[bool] = mapped_column(Boolean, default=False)               # output upscaled to 1080p

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
