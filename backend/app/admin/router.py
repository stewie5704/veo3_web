"""Admin router — user management, stats, ban/unban, quota."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from datetime import datetime

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.videos.models import VideoJob
from app.projects.models import Project, Scene
from app import subscription

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin only")
    return user


class UpdateUserRequest(BaseModel):
    is_active: bool | None = None
    is_banned: bool | None = None
    is_admin: bool | None = None
    quota_videos: int | None = None
    display_name: str | None = None
    grant_plan: str | None = None   # plan id (basic/pro/...) → activate/extend manually


@router.get("/stats")
async def get_stats(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    total_users = (await db.execute(select(func.count()).select_from(User))).scalar()
    active_users = (await db.execute(select(func.count()).select_from(User).where(User.is_active == True))).scalar()
    total_videos = (await db.execute(select(func.count()).select_from(VideoJob))).scalar()
    total_projects = (await db.execute(select(func.count()).select_from(Project))).scalar()
    total_scenes = (await db.execute(select(func.count()).select_from(Scene))).scalar()
    done_videos = (await db.execute(
        select(func.count()).select_from(VideoJob).where(VideoJob.status == "done")
    )).scalar()
    return {
        "total_users": total_users,
        "active_users": active_users,
        "total_videos": total_videos,
        "done_videos": done_videos,
        "total_projects": total_projects,
        "total_scenes": total_scenes,
    }


@router.get("/users")
async def list_users(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    limit: int = 50, offset: int = 0, search: str = "",
):
    q = select(User).order_by(desc(User.created_at)).limit(limit).offset(offset)
    if search:
        q = q.where(User.username.ilike(f"%{search}%") | User.email.ilike(f"%{search}%"))
    res = await db.execute(q)
    users = res.scalars().all()
    return [{
        "id": u.id, "email": u.email, "username": u.username,
        "is_active": u.is_active, "is_admin": u.is_admin, "is_banned": u.is_banned,
        "google_connected": u.google_connected, "has_gemini_key": u.has_gemini_key,
        "quota_videos": u.quota_videos, "videos_generated": u.videos_generated,
        "plan": u.plan, "plan_active": subscription.is_active(u),
        "plan_expires_at": u.plan_expires_at.isoformat() if u.plan_expires_at else None,
        "created_at": u.created_at, "last_login": u.last_login,
    } for u in users]


@router.patch("/users/{user_id}")
async def update_user(
    user_id: str, body: UpdateUserRequest,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if body.is_active is not None:
        user.is_active = body.is_active
    if body.is_banned is not None:
        user.is_banned = body.is_banned
    if body.is_admin is not None:
        user.is_admin = body.is_admin
    if body.quota_videos is not None:
        user.quota_videos = body.quota_videos
    if body.display_name is not None:
        user.display_name = body.display_name
    if body.grant_plan:
        try:
            subscription.activate(user, body.grant_plan)
        except ValueError:
            raise HTTPException(400, f"Gói không hợp lệ: {body.grant_plan}")
    await db.commit()
    return {"ok": True, "plan": user.plan,
            "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None}


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = await db.get(User, user_id)
    if not user:
        raise HTTPException(404, "User not found")
    if user.is_admin:
        raise HTTPException(400, "Không thể xóa admin")
    await db.delete(user)
    await db.commit()
    return {"ok": True}
