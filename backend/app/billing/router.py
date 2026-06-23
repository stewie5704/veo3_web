from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
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


@router.post("/checkout")
async def checkout(body: CheckoutReq, user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    plan = PLANS.get(body.plan)
    if not plan:
        raise HTTPException(400, "Gói không hợp lệ")
    pay = Payment(user_id=user.id, plan=body.plan, amount=int(plan["price"]), currency=plan["currency"])
    db.add(pay)
    await db.commit()
    await db.refresh(pay)
    pay_url = await gateway.create_payment_url(pay)   # None until a gateway is wired
    return {"order_id": pay.id, "amount": pay.amount, "currency": pay.currency,
            "pay_url": pay_url, "status": pay.status}


@router.post("/webhook/{provider}")
async def webhook(provider: str, request: Request, db: AsyncSession = Depends(get_db)):
    """Gateway → here after payment. The provider impl verifies + activates the plan."""
    return await gateway.handle_webhook(provider, request, db)
