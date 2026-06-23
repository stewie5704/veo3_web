"""Payment gateway adapter (seam).

`create_payment_url` + `handle_webhook` are implemented per provider (VNPay / MoMo / Stripe)
once one is chosen. Until then `create_payment_url` returns None — plans can still be granted
manually by an admin. `mark_paid_and_activate` is the gateway-independent "money confirmed →
turn the plan on" step that every provider's verified webhook calls.
"""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import HTTPException


async def create_payment_url(payment) -> str | None:
    """Build the redirect URL to the gateway's hosted checkout for this Payment.
    Returns None until a gateway is wired (frontend then shows 'liên hệ admin')."""
    return None


async def handle_webhook(provider: str, request, db):
    """Verify the gateway callback (signature + amount), then mark_paid_and_activate."""
    raise HTTPException(status_code=501, detail="Cổng thanh toán chưa được cấu hình")


async def mark_paid_and_activate(db, payment, gateway_ref: str | None = None) -> None:
    """Idempotent: mark the order paid and activate/extend the user's plan."""
    from app.auth.models import User
    from app import subscription

    if payment.status == "paid":
        return  # already processed (webhook retries are safe)
    payment.status = "paid"
    payment.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if gateway_ref:
        payment.gateway_ref = gateway_ref
    user = await db.get(User, payment.user_id)
    if user:
        subscription.activate(user, payment.plan)
    await db.commit()
