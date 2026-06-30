"""User-facing affiliate dashboard + wallet (T coin) + withdrawal + auto-renew."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, func, desc, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.auth.models import User
from app.auth.router import get_current_user
from app.config import settings
from app.billing.models import Commission, WalletTxn
from app import affiliate, subscription

router = APIRouter(prefix="/affiliate", tags=["affiliate"])

T_COIN_VND = 10_000      # 1 T = 10.000đ
WITHDRAW_TAX = 0.10      # 10% thuế khi rút
MIN_WITHDRAW_T = 1       # rút tối thiểu 1 T


def _now():
    return datetime.now(timezone.utc).replace(tzinfo=None)


@router.get("/me")
async def affiliate_me(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    if not user.referral_code:
        await affiliate.ensure_referral_code(db, user)
        await db.commit()

    paid_refs = await affiliate.paid_referral_count(db, user.id)
    total_refs = int((await db.execute(
        select(func.count()).select_from(User).where(User.referred_by == user.id)
    )).scalar() or 0)

    locked = bool(getattr(user, "affiliate_rate_locked", False))
    if locked:
        rate, rank = int(user.affiliate_rate or 10), "Tùy chỉnh"
    else:
        rate, rank = affiliate.tier_for(paid_refs)
    nxt = affiliate.next_tier(paid_refs) if not locked else None
    progress = 0
    if nxt:
        # progress within the current band [prev_threshold, next_threshold)
        prevs = [t[0] for t in affiliate.TIERS if t[0] <= paid_refs]
        lo = max(prevs) if prevs else 0
        span = nxt[0] - lo
        progress = round(min(100, max(0, (paid_refs - lo) / span * 100))) if span else 0

    earned = int((await db.execute(
        select(func.coalesce(func.sum(Commission.amount), 0))
        .where(Commission.affiliate_id == user.id, Commission.status == "paid")
    )).scalar() or 0)
    # Tầng 2 (F2 gián tiếp): số người do F1 của mình giới thiệu + hoa hồng F2 đã nhận
    f2_referrals = int((await db.execute(
        select(func.count()).select_from(User).where(
            User.referred_by.in_(select(User.id).where(User.referred_by == user.id)))
    )).scalar() or 0)
    earned_f2 = int((await db.execute(
        select(func.coalesce(func.sum(Commission.amount), 0))
        .where(Commission.affiliate_id == user.id, Commission.status == "paid", Commission.level == 2)
    )).scalar() or 0)
    earned_f1 = earned - earned_f2

    com_rows = (await db.execute(
        select(Commission).where(Commission.affiliate_id == user.id)
        .order_by(desc(Commission.created_at)).limit(20)
    )).scalars().all()
    txn_rows = (await db.execute(
        select(WalletTxn).where(WalletTxn.user_id == user.id)
        .order_by(desc(WalletTxn.created_at)).limit(20)
    )).scalars().all()

    bal = int(user.wallet_balance or 0)
    return {
        "referral_code": user.referral_code,
        "link": f"{settings.frontend_url}/register?ref={user.referral_code}",
        "paid_referrals": paid_refs,
        "total_referrals": total_refs,
        "rate": rate, "rank": rank, "rank_locked": locked,
        "tier2_rate": affiliate.TIER2_RATE,
        "f2_referrals": f2_referrals, "earned_f1": earned_f1, "earned_f2": earned_f2,
        "next": ({"threshold": nxt[0], "rate": nxt[1], "rank": nxt[2]} if nxt else None),
        "progress": progress,
        "tiers": [{"threshold": t[0], "rate": t[1], "rank": t[2]} for t in reversed(affiliate.TIERS)],
        "wallet_vnd": bal, "wallet_t": round(bal / T_COIN_VND, 2),
        "earned_total": earned,
        "t_coin_vnd": T_COIN_VND, "withdraw_tax_pct": int(WITHDRAW_TAX * 100),
        "auto_renew": bool(getattr(user, "auto_renew", False)),
        "plan": user.plan, "plan_active": subscription.is_active(user),
        "plan_expires_at": user.plan_expires_at.isoformat() if user.plan_expires_at else None,
        "commissions": [{
            "amount": c.amount, "rate": c.rate, "status": c.status, "level": getattr(c, "level", 1) or 1,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        } for c in com_rows],
        "txns": [{
            "amount": t.amount, "kind": t.kind, "status": t.status, "note": t.note,
            "created_at": t.created_at.isoformat() if t.created_at else None,
        } for t in txn_rows],
    }


class WithdrawReq(BaseModel):
    amount_t: int           # số T coin muốn rút
    bank: str               # thông tin nhận tiền (ngân hàng / STK / tên / hoặc địa chỉ USDT)


@router.post("/withdraw")
async def withdraw(body: WithdrawReq, user: User = Depends(get_current_user),
                   db: AsyncSession = Depends(get_db)):
    if body.amount_t < MIN_WITHDRAW_T:
        raise HTTPException(400, f"Rút tối thiểu {MIN_WITHDRAW_T} T")
    if not body.bank.strip():
        raise HTTPException(400, "Cần thông tin nhận tiền")
    gross = body.amount_t * T_COIN_VND
    tax = round(gross * WITHDRAW_TAX)
    net = gross - tax
    # Trừ ví NGUYÊN TỬ: chỉ trừ nếu số dư còn đủ (rowcount==1). Tránh 2 request rút song song
    # cùng vượt qua kiểm tra → âm ví / rút trùng. Atomic UPDATE chạy đúng trên cả SQLite & Postgres.
    res = await db.execute(
        update(User).where(User.id == user.id, User.wallet_balance >= gross)
        .values(wallet_balance=User.wallet_balance - gross)
    )
    if res.rowcount != 1:
        raise HTTPException(400, "Số dư ví không đủ")
    db.add(WalletTxn(
        user_id=user.id, amount=-gross, kind="withdraw", status="pending",
        note=f"Rút {body.amount_t}T | nhận {net:,}đ (đã trừ thuế {tax:,}đ) | {body.bank.strip()}",
    ))
    await db.commit()
    return {"ok": True, "gross": gross, "tax": tax, "net": net}


class AutoRenewReq(BaseModel):
    enabled: bool


@router.post("/auto-renew")
async def set_auto_renew(body: AutoRenewReq, user: User = Depends(get_current_user),
                         db: AsyncSession = Depends(get_db)):
    user.auto_renew = body.enabled
    await db.commit()
    return {"ok": True, "auto_renew": user.auto_renew}
