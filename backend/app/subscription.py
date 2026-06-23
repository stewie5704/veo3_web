"""Time-based subscription logic.

A user can generate only while they hold an ACTIVE plan (plan != 'free' and not expired).
`plan_expires_at` is stored naive-UTC (the DateTime column); `_aware` normalises on read.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.plans import PLANS


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


def ensure_can_generate(user) -> None:
    """Raise HTTP 402 if the user has no active subscription."""
    if not is_active(user):
        raise HTTPException(status_code=402, detail="Cần nâng gói để tạo nội dung. Vào mục Nâng gói.")
