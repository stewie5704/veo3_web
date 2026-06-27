"""Admin router — user management, stats, payments, ban/unban, quota, plan grants."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc
from pydantic import BaseModel
from datetime import datetime, timezone

from app.database import get_db
from app.auth.router import get_current_user
from app.auth.models import User
from app.videos.models import VideoJob
from app.projects.models import Project, Scene
from app.billing.models import Payment, AssistantGift
from app.plans import PLANS
from app import subscription

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(user: User = Depends(get_current_user)) -> User:
    if not user.is_admin:
        raise HTTPException(403, "Admin only")
    return user


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


class UpdateUserRequest(BaseModel):
    is_active: bool | None = None
    is_banned: bool | None = None
    is_admin: bool | None = None
    quota_videos: int | None = None
    display_name: str | None = None
    grant_plan: str | None = None   # plan id (m1/m6/m12) → activate/extend manually


@router.get("/stats")
async def get_stats(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    async def count(model, *where):
        q = select(func.count()).select_from(model)
        for w in where:
            q = q.where(w)
        return (await db.execute(q)).scalar() or 0

    now = _now()
    month_start = datetime(now.year, now.month, 1)

    total_users = await count(User)
    active_users = await count(User, User.is_active == True)  # noqa: E712
    banned_users = await count(User, User.is_banned == True)  # noqa: E712
    admin_users = await count(User, User.is_admin == True)    # noqa: E712
    google_users = await count(User, User.google_connected == True)  # noqa: E712
    active_subs = await count(User, User.plan != "free", User.plan_expires_at > now)
    new_users_7d = await count(User, User.created_at >= datetime(now.year, now.month, now.day))

    total_videos = await count(VideoJob)
    done_videos = await count(VideoJob, VideoJob.status == "done")
    failed_videos = await count(VideoJob, VideoJob.status == "failed")
    total_projects = await count(Project)
    total_scenes = await count(Scene)

    # Revenue (paid orders only)
    async def revenue(*where):
        q = select(func.coalesce(func.sum(Payment.amount), 0)).where(Payment.status == "paid")
        for w in where:
            q = q.where(w)
        return (await db.execute(q)).scalar() or 0

    revenue_total = await revenue()
    revenue_month = await revenue(Payment.paid_at >= month_start)
    paid_orders = await count(Payment, Payment.status == "paid")
    pending_orders = await count(Payment, Payment.status == "pending")

    # Active subscription breakdown by plan
    res = await db.execute(
        select(User.plan, func.count()).where(User.plan != "free", User.plan_expires_at > now)
        .group_by(User.plan)
    )
    plan_breakdown = {p: c for p, c in res.all()}

    return {
        "total_users": total_users, "active_users": active_users,
        "banned_users": banned_users, "admin_users": admin_users,
        "google_users": google_users, "active_subs": active_subs,
        "new_users_7d": new_users_7d,
        "total_videos": total_videos, "done_videos": done_videos, "failed_videos": failed_videos,
        "total_projects": total_projects, "total_scenes": total_scenes,
        "revenue_total": int(revenue_total), "revenue_month": int(revenue_month),
        "paid_orders": paid_orders, "pending_orders": pending_orders,
        "plan_breakdown": plan_breakdown,
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
        "display_name": u.display_name,
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
    if user.id == admin.id and body.is_admin is False:
        raise HTTPException(400, "Không thể tự gỡ quyền admin của chính mình")
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


@router.get("/payments")
async def list_payments(
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
    status: str = "", limit: int = 80, offset: int = 0,
):
    q = (select(Payment, User.email, User.username)
         .join(User, User.id == Payment.user_id, isouter=True)
         .order_by(desc(Payment.created_at)).limit(limit).offset(offset))
    if status:
        q = q.where(Payment.status == status)
    res = await db.execute(q)
    rows = res.all()
    return [{
        "id": p.id, "user_id": p.user_id, "email": email, "username": username,
        "plan": p.plan, "plan_label": (PLANS.get(p.plan) or {}).get("label", p.plan),
        "amount": p.amount, "currency": p.currency, "gateway": p.gateway, "status": p.status,
        "gateway_ref": p.gateway_ref,
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "paid_at": p.paid_at.isoformat() if p.paid_at else None,
    } for p, email, username in rows]


@router.post("/payments/{payment_id}/activate")
async def activate_payment(
    payment_id: str,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Manually confirm a (bank-transfer) order: mark paid + activate plan + gift assistants."""
    from app.billing import gateway
    pay = await db.get(Payment, payment_id)
    if not pay:
        raise HTTPException(404, "Đơn hàng không tồn tại")
    if pay.status == "paid":
        return {"ok": True, "already": True}
    await gateway.mark_paid_and_activate(db, pay, gateway_ref=f"manual:{admin.username}")
    return {"ok": True}


@router.get("/assistants")
async def assistant_pool(admin: User = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """How many assistants have been gifted, to how many users, of the total pool."""
    from app.billing.assistants import load_assistants
    total_pool = len(load_assistants())
    res = await db.execute(select(func.count(), func.coalesce(func.sum(AssistantGift.count), 0))
                           .select_from(AssistantGift))
    recipients, gifted = res.one()
    return {"pool_total": total_pool, "recipients": recipients or 0, "gifted": int(gifted or 0)}
