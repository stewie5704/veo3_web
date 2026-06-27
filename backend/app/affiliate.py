"""Affiliate / referral engine: referral codes + commission creation on paid orders."""
from __future__ import annotations

import re
import secrets

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


async def ensure_referral_code(db: AsyncSession, user) -> str:
    """Give the user a unique referral code if they don't have one. Caller commits."""
    if user.referral_code:
        return user.referral_code
    from app.auth.models import User
    base = re.sub(r"[^A-Za-z0-9]", "", (user.username or "REF"))[:5].upper() or "REF"
    for _ in range(12):
        code = f"{base}{secrets.token_hex(3).upper()}"   # 24-bit suffix, e.g. THAIDA1B2C
        exists = await db.execute(select(User.id).where(User.referral_code == code))
        if not exists.scalar_one_or_none():
            user.referral_code = code
            return code
    user.referral_code = secrets.token_hex(6).upper()   # fallback (very unlikely)
    return user.referral_code


async def attach_referrer(db: AsyncSession, new_user, ref_code: str | None) -> None:
    """At registration: link the new user to the affiliate whose code is `ref_code`."""
    if not ref_code:
        return
    from app.auth.models import User
    res = await db.execute(select(User).where(User.referral_code == ref_code.strip().upper()).limit(1))
    affiliate = res.scalars().first()   # .first() = tolerant of any legacy duplicate code
    if affiliate and affiliate.id != new_user.id:
        new_user.referred_by = affiliate.id


async def record_commission(db: AsyncSession, payment, paying_user) -> None:
    """On a confirmed-paid order, create a pending commission for the referrer (if any
    and they're an affiliate). Idempotent via the unique payment_id. Caller commits."""
    if not paying_user or not paying_user.referred_by:
        return
    from app.auth.models import User
    from app.billing.models import Commission

    affiliate = await db.get(User, paying_user.referred_by)
    if not affiliate:
        return
    if affiliate.id == paying_user.id:
        return   # defense-in-depth: never pay a user commission on their own purchase
    # one commission per payment
    dup = await db.execute(select(Commission.id).where(Commission.payment_id == payment.id))
    if dup.scalar_one_or_none():
        return
    # everyone is an affiliate; default 10% unless an admin set a custom rate. rate 0 = disabled.
    rate = affiliate.affiliate_rate
    rate = 10 if rate is None else int(rate)
    if rate <= 0:
        return
    amount = round(int(payment.amount) * rate / 100)
    db.add(Commission(
        affiliate_id=affiliate.id,
        referred_user_id=paying_user.id,
        payment_id=payment.id,
        amount=amount,
        rate=rate,
        status="pending",
    ))
