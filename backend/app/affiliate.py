"""Affiliate / referral engine: referral codes, cultivation-rank tiers, commission +
auto wallet-credit on paid orders."""
from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone

from sqlalchemy import select, func, distinct
from sqlalchemy.ext.asyncio import AsyncSession

# Bậc CTV theo tu tiên — (mốc số khách ĐÃ MUA, % hoa hồng, tên cảnh giới).
# Sắp giảm dần để tier_for trả về bậc cao nhất đạt được.
TIERS = [
    (1000, 30, "Nguyên Anh"),
    (500, 20, "Kim Đan"),
    (100, 15, "Trúc Cơ"),
    (0, 10, "Luyện Khí"),
]

# % hoa hồng TẦNG 2 (F2 gián tiếp): khách do người-mình-giới-thiệu giới thiệu mua -> mình nhận thêm.
# Cố định, KHÔNG theo bậc. Nguồn DUY NHẤT cho cả tính tiền lẫn hiển thị -> đồng bộ toàn hệ.
TIER2_RATE = 5


def tier_for(paid_referrals: int) -> tuple[int, str]:
    """Return (rate%, rank_name) for a given count of paying referrals."""
    for threshold, rate, name in TIERS:
        if paid_referrals >= threshold:
            return rate, name
    return 10, "Luyện Khí"


def next_tier(paid_referrals: int) -> tuple[int, int, str] | None:
    """Return (threshold, rate, name) of the next rank above current count, or None if maxed."""
    higher = [t for t in TIERS if t[0] > paid_referrals]
    return min(higher, key=lambda t: t[0]) if higher else None


async def paid_referral_count(db: AsyncSession, affiliate_id: str) -> int:
    """Number of DISTINCT users referred by this affiliate who have ≥1 PAID order."""
    from app.auth.models import User
    from app.billing.models import Payment
    res = await db.execute(
        select(func.count(distinct(User.id)))
        .select_from(User)
        .join(Payment, Payment.user_id == User.id)
        .where(User.referred_by == affiliate_id, Payment.status == "paid")
    )
    return int(res.scalar() or 0)


async def effective_rate(db: AsyncSession, affiliate) -> int:
    """Commission % for an affiliate: admin-locked custom rate, else the cultivation tier."""
    if getattr(affiliate, "affiliate_rate_locked", False):
        r = affiliate.affiliate_rate
        return 10 if r is None else int(r)
    count = await paid_referral_count(db, affiliate.id)
    return tier_for(count)[0]


async def credit_wallet(db: AsyncSession, user, amount: int, kind: str, note: str = "",
                        status: str = "done") -> None:
    """Add `amount` VND (can be negative) to the user's wallet + log a WalletTxn. Caller commits."""
    from app.billing.models import WalletTxn
    user.wallet_balance = int(user.wallet_balance or 0) + int(amount)
    db.add(WalletTxn(user_id=user.id, amount=int(amount), kind=kind, status=status, note=note,
                     processed_at=(datetime.now(timezone.utc).replace(tzinfo=None) if status == "done" else None)))


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


async def _pay_commission(db: AsyncSession, *, earner, paying_user, payment,
                          rate: int, level: int) -> None:
    """Tạo 1 hoa hồng cho `earner` ở tầng `level` + tự cộng ví ngay (status=paid).
    Idempotent theo (payment_id, level). rate<=0 hoặc tiền=0 -> bỏ qua. Caller commit."""
    from app.billing.models import Commission
    if rate <= 0:
        return
    amount = round(int(payment.amount) * rate / 100)
    if amount <= 0:
        return
    dup = await db.execute(select(Commission.id).where(
        Commission.payment_id == payment.id, Commission.level == level))
    if dup.scalar_one_or_none():
        return
    db.add(Commission(
        affiliate_id=earner.id,
        referred_user_id=paying_user.id,
        payment_id=payment.id,
        level=level,
        amount=amount,
        rate=rate,
        status="paid",                        # auto-credited to wallet right away
        paid_at=datetime.now(timezone.utc).replace(tzinfo=None),
    ))
    tag = "" if level == 1 else " (F2)"
    await credit_wallet(db, earner, amount, "commission",
                        note=f"Hoa hồng{tag} {rate}% đơn {payment.plan}")


async def record_commission(db: AsyncSession, payment, paying_user) -> None:
    """On a confirmed-paid order: trả hoa hồng 2 TẦNG + tự cộng ví ngay (status=paid).
    - Tầng 1 (F1): người giới thiệu TRỰC TIẾP, % theo bậc tu tiên / mức admin khoá.
    - Tầng 2 (F2): tuyến trên của F1 (giới thiệu GIÁN TIẾP), nhận TIER2_RATE% cố định.
    Idempotent theo (payment_id, level). Caller commits."""
    if not paying_user or not paying_user.referred_by:
        return
    from app.auth.models import User

    # Tầng 1 — người giới thiệu trực tiếp
    f1 = await db.get(User, paying_user.referred_by)
    if not f1 or f1.id == paying_user.id:
        return   # defense-in-depth: never pay a user commission on their own purchase
    await _pay_commission(db, earner=f1, paying_user=paying_user, payment=payment,
                          rate=await effective_rate(db, f1), level=1)

    # Tầng 2 — tuyến trên của F1 (nếu có), nhận 5% cố định, độc lập với trạng thái F1
    if not f1.referred_by:
        return
    f2 = await db.get(User, f1.referred_by)
    if not f2 or f2.id in (paying_user.id, f1.id):
        return   # tránh tự trả / vòng giới thiệu lỗi
    await _pay_commission(db, earner=f2, paying_user=paying_user, payment=payment,
                          rate=TIER2_RATE, level=2)
