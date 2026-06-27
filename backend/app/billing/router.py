import json
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.models import User
from app.auth.router import get_current_user
from app.plans import PLANS
from app import subscription
from app.billing import gateway
from app.billing.gateway import ORDER_TTL_SECONDS
from app.billing.models import Payment

router = APIRouter(prefix="/billing", tags=["billing"])


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/plans")
async def list_plans():
    return {"plans": [{"id": k, **v} for k, v in PLANS.items()]}


@router.get("/me")
async def my_subscription(user: User = Depends(get_current_user)):
    # KHÔNG auto-renew ở đây (GET không được gây side-effect tiền). Việc gia hạn do
    # _auto_renew_loop chạy nền (đơn luồng) đảm nhiệm → tránh race trừ tiền 2 lần.
    bal = int(getattr(user, "wallet_balance", 0) or 0)
    return {
        "plan": user.plan,
        "active": subscription.is_active(user),
        "expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "days_left": subscription.days_left(user),
        "wallet_vnd": bal,
        "wallet_t": round(bal / 10_000, 2),
        "auto_renew": bool(getattr(user, "auto_renew", False)),
    }


class CheckoutReq(BaseModel):
    plan: str
    method: str = "payos"   # "payos" | "binance"


class TopupReq(BaseModel):
    amount: int             # VND nạp vào ví
    method: str = "payos"


@router.post("/topup")
async def topup(body: TopupReq, user: User = Depends(get_current_user),
                db: AsyncSession = Depends(get_db)):
    if body.amount < 10_000:
        raise HTTPException(400, "Nạp tối thiểu 10.000đ (1 T)")
    if body.method not in ("payos", "binance"):
        raise HTTPException(400, "Phương thức thanh toán không hợp lệ")
    expires_at = _utcnow_naive() + timedelta(seconds=ORDER_TTL_SECONDS)
    pay = Payment(
        user_id=user.id, plan="topup", amount=int(body.amount),
        currency="VND", gateway=body.method, expires_at=expires_at,
    )
    db.add(pay)
    await db.commit()
    await db.refresh(pay)
    result = await gateway.create_payment_url(pay, user)
    await db.commit()
    return {
        "order_id": pay.id, "amount": pay.amount, "currency": pay.currency,
        "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
        **result,
    }


@router.post("/checkout")
async def checkout(
    body: CheckoutReq,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    plan = PLANS.get(body.plan)
    if not plan:
        raise HTTPException(400, "Gói không hợp lệ")
    if body.method not in ("payos", "binance"):
        raise HTTPException(400, "Phương thức thanh toán không hợp lệ")

    expires_at = _utcnow_naive() + timedelta(seconds=ORDER_TTL_SECONDS)
    pay = Payment(
        user_id=user.id,
        plan=body.plan,
        amount=int(plan["price"]),
        currency=plan["currency"],
        gateway=body.method,
        expires_at=expires_at,
    )
    db.add(pay)
    await db.commit()
    await db.refresh(pay)

    result = await gateway.create_payment_url(pay, user)
    await db.commit()   # persist gateway_ref written by the provider

    return {
        "order_id": pay.id,
        "amount": pay.amount,
        "currency": pay.currency,
        "expires_at": expires_at.replace(tzinfo=timezone.utc).isoformat(),
        **result,
    }


@router.get("/order/{order_id}/status")
async def order_status(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pay = await db.get(Payment, order_id)
    if not pay or pay.user_id != user.id:
        raise HTTPException(404, "Đơn hàng không tồn tại")

    status = await gateway.query_and_sync(db, pay)   # live-syncs paid/expired

    gift_count = 0
    if status == "paid":
        from app.billing.models import AssistantGift
        res = await db.execute(select(AssistantGift).where(AssistantGift.payment_id == pay.id))
        g = res.scalar_one_or_none()
        gift_count = g.count if g else 0

    return {
        "status": status,                            # paid | pending | expired | failed
        "paid_at": pay.paid_at.isoformat() if pay.paid_at else None,
        "expires_at": pay.expires_at.replace(tzinfo=timezone.utc).isoformat() if pay.expires_at else None,
        "plan": pay.plan,
        "gift_count": gift_count,
    }


@router.post("/order/{order_id}/cancel")
async def cancel_order(
    order_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    pay = await db.get(Payment, order_id)
    if not pay or pay.user_id != user.id:
        raise HTTPException(404, "Đơn hàng không tồn tại")
    await gateway.cancel_order(db, pay)
    return {"status": "cancelled"}


@router.get("/assistants")
async def my_assistants(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.billing.models import AssistantGift

    result = await db.execute(select(AssistantGift).where(AssistantGift.user_id == user.id))
    gift = result.scalar_one_or_none()
    if not gift:
        return {"gifted": False, "count": 0, "assistants": []}
    return {"gifted": True, "count": gift.count, "assistants": json.loads(gift.assistants_json)}


@router.post("/webhook/{provider}")
async def webhook(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Gateway → here after payment. Backup path; the in-app poller also syncs."""
    return await gateway.handle_webhook(provider, request, db)
