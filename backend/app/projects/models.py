import uuid
import random
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
    idea: Mapped[str | None] = mapped_column(Text, nullable=True)   # kịch bản Phần 1
    # Kịch bản các phần thêm sau (JSON {"2": "...", "3": "..."}). Phần 1 = idea ở trên.
    part_scripts: Mapped[str | None] = mapped_column(Text, nullable=True)
    style: Mapped[str | None] = mapped_column(String(100), nullable=True)
    model_key: Mapped[str] = mapped_column(String(100), default="veo_3_1_t2v_lite_low_priority")
    aspect_ratio: Mapped[str] = mapped_column(String(10), default="16:9")
    duration_seconds: Mapped[int] = mapped_column(Integer, default=8)
    language: Mapped[str] = mapped_column(String(10), default="vi")
    scene_count: Mapped[int] = mapped_column(Integer, default=0)
    # chain mode — each scene uses last frame of previous as start image
    chain_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    # Âm thanh: 'voiceover' = TTS đọc thoại ghép vào (mồm KHÔNG khớp) |
    # 'character_speak' = đưa thoại vào prompt để Veo cho nhân vật TỰ NÓI (nhép miệng) | 'off' = câm.
    audio_mode: Mapped[str] = mapped_column(String(20), default="voiceover")
    voiceover: Mapped[bool] = mapped_column(Boolean, default=False)   # legacy (= audio_mode=='voiceover')
    voice: Mapped[str] = mapped_column(String(40), default="Kore")
    # Người dùng bấm "Dừng" -> runner bỏ qua các cảnh chưa/đang chạy
    stopped: Mapped[bool] = mapped_column(Boolean, default=False)
    # Seed CỐ ĐỊNH cho cả dự án -> mọi cảnh dùng chung 1 seed => mặt nhân vật ổn định
    # giữa các cảnh (Veo re-roll mặt mới mỗi seed). 0 = dự án cũ -> runner suy seed ổn định từ id.
    seed: Mapped[int] = mapped_column(Integer, default=lambda: random.randint(1, 2 ** 31 - 1))
    # Hồ sơ nhân vật (bible) của dự án — JSON list[CharacterBible]; dùng KHÓA cast cho các phần sau
    character_bible: Mapped[str | None] = mapped_column(Text, nullable=True)
    # auto-merge result
    merged_file: Mapped[str | None] = mapped_column(String(300), nullable=True)
    hd: Mapped[bool] = mapped_column(Boolean, default=False)   # all scenes upscaled to 1080p
    i2v_fix: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())


class Scene(Base):
    __tablename__ = "scenes"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id: Mapped[str] = mapped_column(String(36), ForeignKey("projects.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False)
    index: Mapped[int] = mapped_column(Integer, nullable=False)
    # Truyện nhiều phần: cảnh thuộc "Phần" nào (1 = phần đầu). Thêm kịch bản mới -> part tăng dần.
    part: Mapped[int] = mapped_column(Integer, default=1)
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
    # Giọng TTS riêng cho cảnh (theo nhân vật nói); rỗng = dùng giọng mặc định của project
    voice: Mapped[str] = mapped_column(String(40), default="")
    # Chain: wait for previous scene to complete before rendering
    wait_for_prev: Mapped[bool] = mapped_column(Boolean, default=False)
    hd: Mapped[bool] = mapped_column(Boolean, default=False)   # output upscaled to 1080p
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
