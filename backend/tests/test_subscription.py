"""Unit: time-based subscription logic (app/subscription.py)."""
from datetime import datetime, timezone, timedelta

import pytest
from fastapi import HTTPException

from app import subscription as s


class U:
    def __init__(self):
        self.plan = "free"
        self.plan_expires_at = None


def test_free_user_inactive_and_blocked():
    u = U()
    assert s.is_active(u) is False
    with pytest.raises(HTTPException) as e:
        s.ensure_can_generate(u)
    assert e.value.status_code == 402


def test_activate_grants_active_window():
    u = U()
    s.activate(u, "basic")
    assert u.plan == "basic" and s.is_active(u) is True
    assert 29 < s.days_left(u) <= 30
    s.ensure_can_generate(u)  # must not raise


def test_buying_again_extends_cumulatively():
    u = U()
    s.activate(u, "basic")     # +30
    s.activate(u, "pro_year")  # +365 from current expiry
    assert 393 < s.days_left(u) <= 396


def test_expired_plan_blocks():
    u = U()
    u.plan = "basic"
    u.plan_expires_at = (datetime.now(timezone.utc) - timedelta(days=1)).replace(tzinfo=None)
    assert s.is_active(u) is False


def test_naive_stored_expiry_compares_safely():
    u = U()
    u.plan = "basic"
    u.plan_expires_at = (datetime.now(timezone.utc) + timedelta(days=5)).replace(tzinfo=None)
    assert s.is_active(u) is True


def test_unknown_plan_raises():
    with pytest.raises(ValueError):
        s.activate(U(), "does-not-exist")
