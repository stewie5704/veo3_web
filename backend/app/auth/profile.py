"""Extra auth endpoints: profile update, change password, share tokens."""
import uuid
import hashlib
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.utils import hash_password, verify_password
from app.auth.models import User
from app import subscription as _sub

router = APIRouter(prefix="/profile", tags=["profile"])

# In-memory share tokens: token → video_path
_share_tokens: dict[str, str] = {}


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    username: str | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.get("/me")
async def get_me(user: User = Depends(get_current_user)):
    return {
        "id": user.id, "email": user.email, "username": user.username,
        "display_name": user.display_name, "is_admin": user.is_admin,
        "google_connected": user.google_connected, "has_gemini_key": user.has_gemini_key,
        "quota_videos": user.quota_videos, "videos_generated": user.videos_generated,
        "plan": user.plan, "plan_active": _sub.is_active(user),
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "created_at": user.created_at,
    }


@router.patch("/me")
async def update_profile(
    body: UpdateProfileRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.username is not None:
        existing = await db.execute(
            select(User).where(User.username == body.username, User.id != user.id)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(400, "Username đã được dùng")
        user.username = body.username
    await db.commit()
    return {"ok": True}


@router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not verify_password(body.current_password, user.hashed_password):
        raise HTTPException(400, "Mật khẩu hiện tại không đúng")
    if len(body.new_password) < 6:
        raise HTTPException(400, "Mật khẩu mới tối thiểu 6 ký tự")
    user.hashed_password = hash_password(body.new_password)
    await db.commit()
    return {"ok": True}


@router.post("/share-video")
async def create_share_link(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """Create a public share token for a video file."""
    video_file = payload.get("video_file", "")
    if not video_file:
        raise HTTPException(400, "video_file required")
    token = hashlib.md5(f"{user.id}{video_file}{uuid.uuid4()}".encode()).hexdigest()
    _share_tokens[token] = video_file
    return {"token": token, "url": f"/shared/{token}"}
