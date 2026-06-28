"""Time-based subscription logic.

A user can generate only while they hold an ACTIVE plan (plan != 'free' and not expired).
`plan_expires_at` is stored naive-UTC (the DateTime column); `_aware` normalises on read.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.config import settings
from app.plans import PLANS


TRIAL_HOURS = 24                         # free account: 24h tạo video miễn phí
STORAGE_FREE = 150 * 1024 * 1024         # 150 MB cho free / hết hạn
STORAGE_PAID = 1024 * 1024 * 1024        # 1 GB khi có gói (Pro)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def is_active(user) -> bool:
    if not user.plan or user.plan == "free":
        return False
    exp = _aware(user.plan_expires_at)
    return bool(exp and exp > _now())


def days_left(user) -> float | None:
    exp = _aware(user.plan_expires_at)
    if not exp:
        return None
    return round((exp - _now()).total_seconds() / 86400, 1)


def activate(user, plan_id: str) -> None:
    """Grant/extend a plan. If still active, extend from current expiry; else start from now."""
    plan = PLANS.get(plan_id)
    if not plan:
        raise ValueError(f"unknown plan {plan_id}")
    base = _aware(user.plan_expires_at)
    start = base if (base and base > _now()) else _now()
    user.plan = plan_id
    user.plan_expires_at = (start + timedelta(days=int(plan["days"]))).replace(tzinfo=None)


def set_plan(user, plan_id: str) -> None:
    """Admin manual SET: replace the plan and reset expiry to now + plan.days
    (unlike activate() which extends). Use for manual up/down-grade."""
    plan = PLANS.get(plan_id)
    if not plan:
        raise ValueError(f"unknown plan {plan_id}")
    user.plan = plan_id
    user.plan_expires_at = (_now() + timedelta(days=int(plan["days"]))).replace(tzinfo=None)


def cancel(user) -> None:
    """Admin manual cancel → back to free, no active subscription."""
    user.plan = "free"
    user.plan_expires_at = None


def in_trial(user) -> bool:
    """Free 24h trial: được tạo video trong 24h kể từ lúc đăng ký."""
    created = _aware(getattr(user, "created_at", None))
    return bool(created and _now() - created < timedelta(hours=TRIAL_HOURS))


def trial_ends_at(user):
    created = _aware(getattr(user, "created_at", None))
    return (created + timedelta(hours=TRIAL_HOURS)) if created else None


def can_generate(user) -> bool:
    return is_active(user) or in_trial(user)


def storage_limit(user) -> int:
    """Hạn mức lưu trữ (bytes): 1GB nếu có gói còn hạn, ngược lại 150MB."""
    return STORAGE_PAID if is_active(user) else STORAGE_FREE


async def storage_used(db, user_id: str) -> int:
    """Tổng dung lượng file video của user trên đĩa (clip + bản 1080p cache + phim ghép)."""
    import json
    from pathlib import Path
    from sqlalchemy import select
    from app.config import UPLOAD_PATH
    from app.videos.models import VideoJob
    from app.projects.models import Scene, Project

    def _sz(rel: str, with_hd: bool = True) -> int:
        try:
            total = 0
            p = UPLOAD_PATH / rel
            if p.exists():
                total += p.stat().st_size
            if with_hd:
                pp = Path(rel)
                hd = UPLOAD_PATH / pp.with_name(pp.stem + "__1080" + pp.suffix)
                if hd.exists():
                    total += hd.stat().st_size
            return total
        except OSError:
            return 0

    used = 0
    for (of,) in (await db.execute(select(VideoJob.output_files).where(VideoJob.user_id == user_id))).all():
        for f in json.loads(of or "[]"):
            used += _sz(f)
    for (vf,) in (await db.execute(
        select(Scene.video_file).where(Scene.user_id == user_id, Scene.video_file.isnot(None))
    )).all():
        used += _sz(vf)
    for (mf,) in (await db.execute(
        select(Project.merged_file).where(Project.user_id == user_id, Project.merged_file.isnot(None))
    )).all():
        used += _sz(mf, with_hd=False)
    return used


def ensure_can_generate(user) -> None:
    """Raise HTTP 403/402 nếu không được tạo: chưa xác minh email, hoặc hết trial & chưa có gói."""
    if settings.email_verify_required and not getattr(user, "email_verified", True):
        raise HTTPException(status_code=403, detail="Vui lòng xác minh email trước khi tạo nội dung.")
    if not can_generate(user):
        raise HTTPException(status_code=402,
                            detail="Hết 24h dùng thử miễn phí. Nâng gói để tiếp tục tạo nội dung.")


async def ensure_storage(db, user) -> None:
    """Raise HTTP 402 if the user is at/over their storage quota."""
    limit = storage_limit(user)
    used = await storage_used(db, user.id)
    if used >= limit:
        mb = limit // (1024 * 1024)
        nxt = "Nâng gói để có 1GB." if not is_active(user) else "Xóa bớt video cũ để giải phóng."
        raise HTTPException(status_code=402,
                            detail=f"Đã đầy dung lượng lưu trữ ({mb}MB). {nxt}")
