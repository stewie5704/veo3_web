"""Payment gateway: PayOS (banking VN, embedded VietQR) + Binance Pay (USDT).

In-app flow (no redirect): checkout returns the raw VietQR string + bank details;
the frontend renders the QR, shows a 5-minute countdown, and polls
GET /billing/order/{id}/status. That status endpoint calls `query_and_sync` here,
which live-queries the provider and flips the order to paid the moment money lands
(works even if the webhook is slow/unreachable). Webhooks remain as a backup.

Every paid path asserts the provider-reported amount ≥ the order amount before
activating, so an underpayment / stale order never grants a full plan.

PayOS docs:   https://payos.vn/docs/api/
Binance Pay:  https://developers.binance.com/docs/binance-pay/api-order-create-v3
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import secrets
import time
from decimal import Decimal
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import settings

log = logging.getLogger("billing")

PAYOS_BASE = "https://api-merchant.payos.vn"
BINANCE_BASE = "https://bpay.binanceapi.com"

ORDER_TTL_SECONDS = 300  # 5 minutes

# BIN → tên ngân hàng (hiển thị cho user; mặc định "Ngân hàng" nếu chưa map)
BANK_NAMES = {
    "970422": "MB Bank", "970415": "VietinBank", "970436": "Vietcombank",
    "970418": "BIDV", "970405": "Agribank", "970407": "Techcombank",
    "970416": "ACB", "970432": "VPBank", "970423": "TPBank",
    "970403": "Sacombank", "970437": "HDBank", "970448": "OCB",
    "970429": "SCB", "970441": "VIB", "970443": "SHB",
    "970431": "Eximbank", "970426": "MSB", "970409": "BacABank",
    "970412": "PVcomBank", "970419": "NCB", "970424": "ShinhanBank",
    "970425": "ABBank", "970428": "NamABank", "970430": "PGBank",
    "970440": "SeABank", "970446": "COOPBANK", "546034": "CAKE", "963388": "Timo",
}


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def bank_name(bin_code: str | None) -> str:
    return BANK_NAMES.get(str(bin_code or ""), "Ngân hàng")


# ─── Amount guards (anti-underpayment) ───────────────────────────────────────

def _payos_amount_ok(d: dict, payment) -> bool:
    """PayOS reports VND integers; amountPaid is the actually-collected sum."""
    paid = d.get("amountPaid")
    if paid is None:
        paid = d.get("amount")
    try:
        return int(paid) >= int(payment.amount)
    except (TypeError, ValueError):
        return False


def _binance_amount_ok(reported, payment) -> bool:
    try:
        expected = Decimal(str(round(payment.amount / settings.usdt_vnd_rate, 2)))
        return Decimal(str(reported)) >= expected   # exact or overpay
    except Exception:
        return False


def _amount_ok(payment, d: dict | None) -> bool:
    if payment.gateway == "payos":
        return _payos_amount_ok(d or {}, payment)
    if payment.gateway == "binance":
        return _binance_amount_ok((d or {}).get("orderAmount"), payment)
    return False


# ─── PayOS ──────────────────────────────────────────────────────────────────

def _payos_headers() -> dict:
    return {
        "x-client-id": settings.payos_client_id,
        "x-api-key": settings.payos_api_key,
        "Content-Type": "application/json",
    }


def _payos_sign(data: dict) -> str:
    """HMAC-SHA256 over sorted key=value pairs, matching PayOS's
    sortObjDataByKey + convertObjToQueryStr (null -> '', keys never dropped)."""
    def fmt(v):
        if v is None:
            return ""
        if isinstance(v, bool):
            return "true" if v else "false"
        if isinstance(v, (dict, list)):
            return json.dumps(v, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        return str(v)
    raw = "&".join(f"{k}={fmt(data[k])}" for k in sorted(data))
    return hmac.new(settings.payos_checksum_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


def _payos_create_signature(amount: int, cancel_url: str, description: str,
                            order_code: int, return_url: str) -> str:
    """Create-request signature uses a FIXED key order, not alphabetical."""
    raw = (f"amount={amount}&cancelUrl={cancel_url}&description={description}"
           f"&orderCode={order_code}&returnUrl={return_url}")
    return hmac.new(settings.payos_checksum_key.encode(), raw.encode(), hashlib.sha256).hexdigest()


async def _payos_create(payment, user) -> dict:
    from app.plans import PLANS

    plan_info = PLANS.get(payment.plan, {})
    # Deterministic, collision-free orderCode derived from the Payment id
    order_code = int(payment.id.replace("-", "")[:15], 16) % 9_999_999_997 + 1
    description = f"AUTOCUT {payment.plan}".upper()[:25]   # bank memo, ≤ 25 chars
    return_url = f"{settings.frontend_url}/billing?status=success&order={payment.id}"
    cancel_url = f"{settings.frontend_url}/billing?status=cancel&order={payment.id}"

    payload = {
        "orderCode": order_code,
        "amount": payment.amount,
        "description": description,
        "cancelUrl": cancel_url,
        "returnUrl": return_url,
        "expiredAt": int(time.time()) + ORDER_TTL_SECONDS,
        "items": [{"name": plan_info.get("label", payment.plan), "quantity": 1, "price": payment.amount}],
        "buyerName": (getattr(user, "display_name", None) or user.username or "")[:50],
        "buyerEmail": user.email or "",
        "signature": _payos_create_signature(payment.amount, cancel_url, description, order_code, return_url),
    }

    payment.gateway_ref = str(order_code)  # keep for query/cancel/webhook lookup

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{PAYOS_BASE}/v2/payment-requests", json=payload, headers=_payos_headers())

    body = r.json()
    if body.get("code") != "00":
        raise HTTPException(400, f"PayOS: {body.get('desc', 'Lỗi tạo đơn hàng')}")

    d = body["data"]
    return {
        "method": "payos",
        "qr_code": d.get("qrCode"),                 # raw VietQR string → render in-app
        "account_number": d.get("accountNumber"),
        "account_name": d.get("accountName"),
        "bin": d.get("bin"),
        "bank_name": bank_name(d.get("bin")),
        "description": d.get("description") or description,
        "checkout_url": d.get("checkoutUrl"),       # fallback only
        "order_code": str(order_code),
    }


async def _payos_query(order_code: str) -> dict | None:
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.get(f"{PAYOS_BASE}/v2/payment-requests/{order_code}", headers=_payos_headers())
    body = r.json()
    return body.get("data") if body.get("code") == "00" else None


async def _payos_cancel(order_code: str) -> None:
    async with httpx.AsyncClient(timeout=15) as client:
        await client.post(
            f"{PAYOS_BASE}/v2/payment-requests/{order_code}/cancel",
            json={"cancellationReason": "Người dùng hủy đơn"},
            headers=_payos_headers(),
        )


async def _payos_webhook(request, db) -> dict:
    body = await request.json()
    webhook_data: dict = body.get("data", {})
    received_sig: str = body.get("signature", "")

    if not hmac.compare_digest(_payos_sign(webhook_data), received_sig):
        raise HTTPException(400, "Chữ ký PayOS không hợp lệ")

    if str(webhook_data.get("code", "")) != "00":
        return {"received": True}

    order_code = str(webhook_data.get("orderCode", ""))
    from app.billing.models import Payment as Pay

    result = await db.execute(
        select(Pay).where(Pay.gateway_ref == order_code, Pay.gateway == "payos")
        .order_by(Pay.created_at.desc()).limit(1)
    )
    payment = result.scalars().first()
    if payment:
        if _payos_amount_ok(webhook_data, payment):
            await mark_paid_and_activate(db, payment)
        else:
            log.warning("PayOS underpaid order=%s exp=%s got=%s",
                        order_code, payment.amount, webhook_data.get("amount"))
    return {"received": True}


# ─── Binance Pay ─────────────────────────────────────────────────────────────

def _binance_sign(timestamp: str, nonce: str, body: str) -> str:
    payload = f"{timestamp}\n{nonce}\n{body}\n"
    return hmac.new(settings.binance_secret_key.encode(), payload.encode(), hashlib.sha512).hexdigest().upper()


def _binance_headers(body: str) -> dict:
    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)
    return {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": settings.binance_api_key,
        "BinancePay-Signature": _binance_sign(timestamp, nonce, body),
    }


async def _binance_post(path: str, payload: dict) -> dict:
    body = json.dumps(payload, separators=(",", ":"))
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{BINANCE_BASE}{path}", content=body, headers=_binance_headers(body))
    return r.json()


async def _binance_create(payment) -> dict:
    from app.plans import PLANS

    plan_info = PLANS.get(payment.plan, {})
    usdt_amount = round(payment.amount / settings.usdt_vnd_rate, 2)
    merchant_trade_no = payment.id.replace("-", "")   # 32 hex chars

    payload = {
        "env": {"terminalType": "WEB"},
        "merchantTradeNo": merchant_trade_no,
        "orderAmount": str(usdt_amount),
        "currency": "USDT",
        "goods": {
            "goodsType": "02",
            "goodsCategory": "Z000",
            "referenceGoodsId": payment.plan,
            "goodsName": f"AI AutoCut {plan_info.get('label', payment.plan)}"[:256],
            "goodsUnitAmount": {"currency": "USDT", "amount": str(usdt_amount)},
        },
        "returnUrl": f"{settings.frontend_url}/billing?status=success&order={payment.id}",
        "cancelUrl": f"{settings.frontend_url}/billing?status=cancel&order={payment.id}",
    }

    data = await _binance_post("/binancepay/openapi/v3/order", payload)
    if data.get("status") != "SUCCESS":
        raise HTTPException(400, f"Binance Pay: {data.get('errorMessage', 'Lỗi tạo đơn')}")

    d = data["data"]
    payment.gateway_ref = d.get("prepayId", merchant_trade_no)
    return {
        "method": "binance",
        "usdt_amount": usdt_amount,
        "qr_content": d.get("qrContent"),     # raw string → render QR in-app
        "qr_url": d.get("qrcodeLink"),         # hosted QR image (fallback)
        "deeplink": d.get("deeplink"),
        "universal_url": d.get("universalUrl"),
        "prepay_id": d.get("prepayId"),
    }


async def _binance_query(merchant_trade_no: str) -> dict | None:
    data = await _binance_post("/binancepay/openapi/v2/order/query", {"merchantTradeNo": merchant_trade_no})
    return data.get("data") if data.get("status") == "SUCCESS" else None


async def _binance_close(merchant_trade_no: str) -> None:
    try:
        await _binance_post("/binancepay/openapi/v2/order/close", {"merchantTradeNo": merchant_trade_no})
    except Exception:
        pass


async def _binance_webhook(request, db) -> dict:
    body_bytes = await request.body()
    body_str = body_bytes.decode()
    h = request.headers
    sig = _binance_sign(h.get("BinancePay-Timestamp", ""), h.get("BinancePay-Nonce", ""), body_str)
    if not hmac.compare_digest(sig, h.get("BinancePay-Signature", "")):
        raise HTTPException(400, "Chữ ký Binance Pay không hợp lệ")

    body = json.loads(body_str)
    if body.get("bizStatus") != "PAY_SUCCESS":
        return {"returnCode": "SUCCESS", "returnMessage": None}

    biz = json.loads(body.get("data", "{}"))
    m = biz.get("merchantTradeNo", "")
    if len(m) == 32:
        payment_id = f"{m[:8]}-{m[8:12]}-{m[12:16]}-{m[16:20]}-{m[20:]}"
        from app.billing.models import Payment as Pay
        pay = await db.get(Pay, payment_id)
        if pay:
            if _binance_amount_ok(biz.get("orderAmount"), pay):
                await mark_paid_and_activate(db, pay)
            else:
                log.warning("Binance underpaid order=%s got=%s", payment_id, biz.get("orderAmount"))
    return {"returnCode": "SUCCESS", "returnMessage": None}


# ─── Public API ──────────────────────────────────────────────────────────────

async def create_payment_url(payment, user=None) -> dict:
    if payment.gateway == "payos":
        if not settings.payos_client_id:
            raise HTTPException(503, "PayOS chưa được cấu hình — liên hệ admin")
        return await _payos_create(payment, user)
    if payment.gateway == "binance":
        if not settings.binance_api_key:
            raise HTTPException(503, "Binance Pay chưa được cấu hình — liên hệ admin")
        return await _binance_create(payment)
    raise HTTPException(400, "Phương thức thanh toán không hợp lệ")


async def _live_query(payment) -> tuple[str, dict | None]:
    """Returns (normalized, data). normalized: paid | unpaid | cancelled."""
    if payment.gateway == "payos":
        d = await _payos_query(payment.gateway_ref)
        st = (d or {}).get("status", "")
        if st == "PAID":
            return "paid", d
        if st in ("CANCELLED", "EXPIRED"):
            return "cancelled", d
        return "unpaid", d
    if payment.gateway == "binance":
        d = await _binance_query(payment.id.replace("-", ""))
        st = (d or {}).get("status", "")
        if st == "PAID":
            return "paid", d
        if st in ("CANCELED", "EXPIRED", "ERROR"):
            return "cancelled", d
        return "unpaid", d
    return "unpaid", None


async def query_and_sync(db, payment) -> str:
    """Live-query the provider, sync the DB. Returns: paid|pending|expired."""
    if payment.status == "paid":
        return "paid"
    if payment.status == "failed":
        return "expired"

    expired_locally = bool(payment.expires_at and payment.expires_at < _utcnow_naive())

    try:
        status, d = await _live_query(payment)
        if status == "paid":
            if _amount_ok(payment, d):
                await mark_paid_and_activate(db, payment)
                return "paid"
            # Underpaid — never activate; keep pending so support can reconcile
            log.warning("Underpaid %s order=%s", payment.gateway, payment.id)
            return "pending"
        if status == "cancelled":
            payment.status = "failed"
            await db.commit()
            return "expired"
    except HTTPException:
        raise
    except Exception:
        # Provider unreachable — never force-fail a possibly-paid order
        return "pending"

    # Provider reachable and confirms unpaid → safe to expire on the local clock
    if expired_locally:
        await _cancel_at_provider(payment)
        payment.status = "failed"
        await db.commit()
        return "expired"

    return "pending"


async def _cancel_at_provider(payment) -> None:
    try:
        if payment.gateway == "payos" and payment.gateway_ref:
            await _payos_cancel(payment.gateway_ref)
        elif payment.gateway == "binance":
            await _binance_close(payment.id.replace("-", ""))
    except Exception:
        pass


async def cancel_order(db, payment) -> None:
    """User-initiated cancel: close at provider + mark failed (idempotent)."""
    if payment.status == "paid":
        raise HTTPException(400, "Đơn đã thanh toán, không thể hủy")
    if payment.status == "failed":
        return
    await _cancel_at_provider(payment)
    payment.status = "failed"
    await db.commit()


async def handle_webhook(provider: str, request, db) -> dict:
    if provider == "payos":
        return await _payos_webhook(request, db)
    if provider == "binance":
        return await _binance_webhook(request, db)
    raise HTTPException(404, f"Provider '{provider}' không được hỗ trợ")


async def mark_paid_and_activate(db, payment, gateway_ref: str | None = None) -> None:
    """Idempotent: mark paid → activate plan → gift assistants (first purchase only)."""
    from app.auth.models import User
    from app import subscription
    from app.billing.assistants import gift_assistants_if_eligible
    from app.plans import PLANS

    if payment.status == "paid":
        return

    payment.status = "paid"
    payment.paid_at = _utcnow_naive()
    if gateway_ref:
        payment.gateway_ref = gateway_ref

    user = await db.get(User, payment.user_id)
    if user:
        subscription.activate(user, payment.plan)
        count = int(PLANS.get(payment.plan, {}).get("assistants", 0))
        if count > 0:
            await gift_assistants_if_eligible(db, user.id, payment.id, count)
        from app.affiliate import record_commission
        await record_commission(db, payment, user)

    try:
        await db.commit()
    except IntegrityError:
        # A concurrent paid-transition (webhook vs poller vs admin) already recorded
        # this — the unique(commission.payment_id) constraint fired. Treat as done.
        await db.rollback()
