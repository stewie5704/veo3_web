import json
import uuid
import shutil
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from pydantic import BaseModel
from pathlib import Path
from datetime import datetime, timezone

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.videos.models import VideoJob, JobStatus
from app.config import UPLOAD_PATH
from app.pipeline.runner import run_video_job
from app import subscription

router = APIRouter(prefix="/videos", tags=["videos"])

JOB_IMG_DIR = UPLOAD_PATH.parent / "images" / "jobs"
JOB_IMG_DIR.mkdir(parents=True, exist_ok=True)


def _save_job_image(f: UploadFile) -> str:
    """Lưu ảnh upload cho tool I2V/R2V -> trả đường dẫn tuyệt đối (cho _generate_one upload lên Flow)."""
    ext = (Path(f.filename or "").suffix or ".jpg").lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        ext = ".jpg"
    dest = JOB_IMG_DIR / f"{uuid.uuid4().hex[:12]}{ext}"
    with open(dest, "wb") as out:
        shutil.copyfileobj(f.file, out)
    return str(dest)


def _ensure_can_render(user: User):
    subscription.ensure_can_generate(user)   # 402 nếu chưa có gói còn hạn
    if not user.google_connected and not user.gemini_api_key:
        raise HTTPException(400, "Cần kết nối Google Ultra hoặc nhập Gemini API key trước")


class CreateJobRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"
    duration_seconds: int = 8
    count: int = 1
    model_key: str = "veo_3_1_t2v_lite_low_priority"


class JobResponse(BaseModel):
    id: str
    prompt: str
    kind: str = "t2v"        # t2v | i2v (có start_image) | r2v (có ref_images) -> feed tool lọc theo đây
    aspect_ratio: str
    duration_seconds: int
    count: int
    model_key: str
    status: str
    progress: int
    error_msg: str | None
    output_files: list[str]
    thumbnails: list[str]
    created_at: datetime
    completed_at: datetime | None

    model_config = {"from_attributes": True}


def _job_to_response(job: VideoJob) -> JobResponse:
    kind = "i2v" if getattr(job, "start_image", None) else ("r2v" if getattr(job, "ref_images", None) else "t2v")
    return JobResponse(
        id=job.id,
        prompt=job.prompt,
        kind=kind,
        aspect_ratio=job.aspect_ratio,
        duration_seconds=job.duration_seconds,
        count=job.count,
        model_key=job.model_key,
        status=job.status,
        progress=job.progress,
        error_msg=job.error_msg,
        output_files=json.loads(job.output_files or "[]"),
        thumbnails=json.loads(job.thumbnails or "[]"),
        created_at=job.created_at,
        completed_at=job.completed_at,
    )


@router.post("/create", response_model=JobResponse)
async def create_job(
    body: CreateJobRequest,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    subscription.ensure_can_generate(user)   # 402 nếu hết hạn dùng thử & chưa có gói
    await subscription.ensure_storage(db, user)   # 402 nếu đầy dung lượng
    if not user.google_connected and not user.gemini_api_key:
        raise HTTPException(
            status_code=400,
            detail="Bạn cần kết nối tài khoản Google Ultra hoặc nhập Gemini API key trước"
        )

    job = VideoJob(
        user_id=user.id,
        prompt=body.prompt,
        aspect_ratio=body.aspect_ratio,
        duration_seconds=body.duration_seconds,
        count=body.count,
        model_key=body.model_key,
    )
    db.add(job)
    await db.commit()
    await db.refresh(job)

    # Run in background
    background_tasks.add_task(run_video_job, job.id, user.id)

    return _job_to_response(job)


@router.post("/create-i2v", response_model=JobResponse)
async def create_i2v(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(...),
    prompt: str = Form(...),
    aspect_ratio: str = Form("16:9"),
    duration_seconds: int = Form(8),
    model_key: str = Form("veo_3_1_t2v_lite_low_priority"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Frames → Video (I2V): 1 ảnh = khung hình đầu, video chuyển động TỪ nó."""
    _ensure_can_render(user)
    await subscription.ensure_storage(db, user)
    job = VideoJob(user_id=user.id, prompt=prompt, aspect_ratio=aspect_ratio,
                   duration_seconds=duration_seconds, count=1, model_key=model_key,
                   start_image=_save_job_image(image))
    db.add(job); await db.commit(); await db.refresh(job)
    background_tasks.add_task(run_video_job, job.id, user.id)
    return _job_to_response(job)


@router.post("/create-r2v", response_model=JobResponse)
async def create_r2v(
    background_tasks: BackgroundTasks,
    images: list[UploadFile] = File(...),
    prompt: str = Form(...),
    aspect_ratio: str = Form("16:9"),
    duration_seconds: int = Form(8),
    model_key: str = Form("veo_3_1_t2v_lite_low_priority"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Ingredients → Video (R2V): 1-3 ảnh tham chiếu (giữ mặt nhân vật/vật thể) -> cảnh mới."""
    _ensure_can_render(user)
    await subscription.ensure_storage(db, user)
    if not images:
        raise HTTPException(400, "Cần ít nhất 1 ảnh tham chiếu")
    paths = [_save_job_image(f) for f in images[:3]]   # Veo cap 3 ảnh
    job = VideoJob(user_id=user.id, prompt=prompt, aspect_ratio=aspect_ratio,
                   duration_seconds=duration_seconds, count=1, model_key=model_key,
                   ref_images=json.dumps(paths))
    db.add(job); await db.commit(); await db.refresh(job)
    background_tasks.add_task(run_video_job, job.id, user.id)
    return _job_to_response(job)


@router.post("/{job_id}/retry", response_model=JobResponse)
async def retry_job(
    job_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Render lại 1 video lẻ đã fail (vd lỗi captcha/extension) — khỏi phải tạo lại từ đầu."""
    job = await db.get(VideoJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(404, "Không tìm thấy job")
    _ensure_can_render(user)
    job.status = JobStatus.pending
    job.error_msg = None
    job.progress = 0
    await db.commit()
    await db.refresh(job)
    background_tasks.add_task(run_video_job, job.id, user.id)
    return _job_to_response(job)


@router.get("/", response_model=list[JobResponse])
async def list_jobs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    result = await db.execute(
        select(VideoJob)
        .where(VideoJob.user_id == user.id)
        .order_by(desc(VideoJob.created_at))
        .limit(limit)
        .offset(offset)
    )
    jobs = result.scalars().all()
    return [_job_to_response(j) for j in jobs]


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(VideoJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")
    return _job_to_response(job)


@router.get("/{job_id}/download/{file_index}")
async def download_video(
    job_id: str,
    file_index: int,
    res: str = "720",   # "720" = original | "1080" = upscale on demand
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(VideoJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")

    files = json.loads(job.output_files or "[]")
    if file_index >= len(files):
        raise HTTPException(status_code=404, detail="File không tồn tại")

    file_path = UPLOAD_PATH / files[file_index]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File đã bị xóa")

    tag = "720p"
    if res == "1080":
        from app.pipeline.runner import ensure_1080
        hd = await ensure_1080(file_path, job.aspect_ratio)
        if hd:
            file_path, tag = hd, "1080p"

    return FileResponse(
        path=str(file_path),
        filename=f"veo3_{job_id[:8]}_{file_index + 1}_{tag}.mp4",
        media_type="video/mp4",
    )


@router.delete("/{job_id}")
async def delete_job(
    job_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    job = await db.get(VideoJob, job_id)
    if not job or job.user_id != user.id:
        raise HTTPException(status_code=404, detail="Không tìm thấy job")

    # Delete files
    for f in json.loads(job.output_files or "[]"):
        p = UPLOAD_PATH / f
        if p.exists():
            p.unlink()

    await db.delete(job)
    await db.commit()
    return {"ok": True}
