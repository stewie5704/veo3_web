import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi import Request
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.models import User
from app.auth.router import get_current_user
from app.plans import PLANS
from app import subscription
from app.billing import gateway
from app.billing.models import Payment

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/plans")
async def list_plans():
    return {"plans": [{"id": k, **v} for k, v in PLANS.items()]}


@router.get("/me")
async def my_subscription(user: User = Depends(get_current_user)):
    return {
        "plan": user.plan,
        "active": subscription.is_active(user),
        "expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "days_left": subscription.days_left(user),
    }


class CheckoutReq(BaseModel):
    plan: str
    method: str = "payos"   # "payos" | "binance"


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

    pay = Payment(
        user_id=user.id,
        plan=body.plan,
        amount=int(plan["price"]),
        currency=plan["currency"],
        gateway=body.method,
    )
    db.add(pay)
    await db.commit()
    await db.refresh(pay)

    result = await gateway.create_payment_url(pay, user)
    await db.commit()   # persist gateway_ref written by provider

    return {
        "order_id": pay.id,
        "amount": pay.amount,
        "currency": pay.currency,
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
    return {
        "status": pay.status,
        "paid_at": pay.paid_at.isoformat() if pay.paid_at else None,
    }


@router.get("/assistants")
async def my_assistants(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from app.billing.models import AssistantGift

    result = await db.execute(
        select(AssistantGift).where(AssistantGift.user_id == user.id)
    )
    gift = result.scalar_one_or_none()
    if not gift:
        return {"gifted": False, "count": 0, "assistants": []}
    return {
        "gifted": True,
        "count": gift.count,
        "assistants": json.loads(gift.assistants_json),
    }


@router.post("/webhook/{provider}")
async def webhook(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Gateway → here after payment. Provider impl verifies + activates the plan."""
    return await gateway.handle_webhook(provider, request, db)
