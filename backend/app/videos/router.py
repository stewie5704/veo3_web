import json
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
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


class CreateJobRequest(BaseModel):
    prompt: str
    aspect_ratio: str = "16:9"
    duration_seconds: int = 8
    count: int = 1
    model_key: str = "veo_3_1_t2v_lite_low_priority"


class JobResponse(BaseModel):
    id: str
    prompt: str
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
    return JobResponse(
        id=job.id,
        prompt=job.prompt,
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
    subscription.ensure_can_generate(user)   # 402 nếu chưa có gói còn hạn
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

    return FileResponse(
        path=str(file_path),
        filename=f"veo3_{job_id[:8]}_{file_index + 1}.mp4",
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
