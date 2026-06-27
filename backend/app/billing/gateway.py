"""Payment gateway: PayOS (banking VN) + Binance Pay (USDT).

PayOS docs:   https://payos.vn/docs/api/
Binance Pay:  https://developers.binance.com/docs/binance-pay/api-order-create-v3
"""
from __future__ import annotations

import hashlib
import hmac
import json
import secrets
import time
from datetime import datetime, timezone

import httpx
from fastapi import HTTPException
from sqlalchemy import select

from app.config import settings

PAYOS_BASE = "https://api-merchant.payos.vn"
BINANCE_BASE = "https://bpay.binanceapi.com"


# ─── PayOS ──────────────────────────────────────────────────────────────────

def _payos_sign(data: dict) -> str:
    """HMAC-SHA256 of sorted key=value pairs, PayOS style."""
    raw = "&".join(f"{k}={data[k]}" for k in sorted(data))
    return hmac.new(
        settings.payos_checksum_key.encode(),
        raw.encode(),
        hashlib.sha256,
    ).hexdigest()


async def _payos_create(payment, user) -> dict:
    from app.plans import PLANS

    plan_info = PLANS.get(payment.plan, {})
    # orderCode: positive int ≤ 9 999 999 999
    order_code = int(time.time() * 1000) % 9_999_999_998 + 1
    description = f"AutoCut {payment.plan}"  # ASCII-safe, ≤ 25 chars
    return_url = f"{settings.frontend_url}/billing?status=success&order={payment.id}"
    cancel_url = f"{settings.frontend_url}/billing?status=cancel&order={payment.id}"

    checksum_data = {
        "amount": payment.amount,
        "cancelUrl": cancel_url,
        "description": description,
        "orderCode": order_code,
        "returnUrl": return_url,
    }

    payload = {
        **checksum_data,
        "items": [
            {
                "name": plan_info.get("label", payment.plan),
                "quantity": 1,
                "price": payment.amount,
            }
        ],
        "buyerName": (user.display_name or user.username or "")[:50],
        "buyerEmail": user.email or "",
        "buyerPhone": "",
        "expiredAt": int(time.time()) + 3600,
        "signature": _payos_sign(checksum_data),
    }

    headers = {
        "x-client-id": settings.payos_client_id,
        "x-api-key": settings.payos_api_key,
        "Content-Type": "application/json",
    }

    # Persist orderCode for webhook lookup before the API call
    payment.gateway_ref = str(order_code)

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(f"{PAYOS_BASE}/v2/payment-requests", json=payload, headers=headers)

    data = r.json()
    if data.get("code") == "00":
        return {"pay_url": data["data"]["checkoutUrl"], "method": "payos"}
    raise HTTPException(400, f"PayOS: {data.get('desc', 'Lỗi tạo đơn hàng')}")


async def _payos_webhook(request, db) -> dict:
    body = await request.json()
    webhook_data: dict = body.get("data", {})
    received_sig: str = body.get("signature", "")

    # Verify over ALL fields in `data` (sorted)
    expected_sig = _payos_sign({k: v for k, v in webhook_data.items() if v is not None})
    if not hmac.compare_digest(expected_sig, received_sig):
        raise HTTPException(400, "Chữ ký PayOS không hợp lệ")

    if str(webhook_data.get("code", "")) != "00":
        return {"received": True}  # cancelled / failed

    order_code = str(webhook_data.get("orderCode", ""))
    from app.billing.models import Payment as Pay

    result = await db.execute(
        select(Pay).where(Pay.gateway_ref == order_code, Pay.gateway == "payos")
    )
    payment = result.scalar_one_or_none()
    if payment:
        gateway_ref = str(webhook_data.get("reference") or order_code)
        await mark_paid_and_activate(db, payment, gateway_ref)

    return {"received": True}


# ─── Binance Pay ─────────────────────────────────────────────────────────────

def _binance_sign(timestamp: str, nonce: str, body: str) -> str:
    payload = f"{timestamp}\n{nonce}\n{body}\n"
    return hmac.new(
        settings.binance_secret_key.encode(),
        payload.encode(),
        hashlib.sha512,
    ).hexdigest().upper()


async def _binance_create(payment) -> dict:
    from app.plans import PLANS

    plan_info = PLANS.get(payment.plan, {})
    usdt_amount = round(payment.amount / settings.usdt_vnd_rate, 2)
    # UUID without dashes = exactly 32 hex chars (Binance merchantTradeNo max 32)
    merchant_trade_no = payment.id.replace("-", "")

    timestamp = str(int(time.time() * 1000))
    nonce = secrets.token_hex(16)  # 32 hex chars

    body = json.dumps(
        {
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
        },
        separators=(",", ":"),
    )

    headers = {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Certificate-SN": settings.binance_api_key,
        "BinancePay-Signature": _binance_sign(timestamp, nonce, body),
    }

    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(
            f"{BINANCE_BASE}/binancepay/openapi/v3/order",
            content=body,
            headers=headers,
        )

    data = r.json()
    if data.get("status") == "SUCCESS":
        order_data = data["data"]
        payment.gateway_ref = order_data.get("prepayId", merchant_trade_no)
        return {
            "method": "binance",
            "usdt_amount": usdt_amount,
            "qr_url": order_data.get("qrcodeLink"),
            "deeplink": order_data.get("deeplink"),
            "universal_url": order_data.get("universalUrl"),
            "prepay_id": order_data.get("prepayId"),
        }
    raise HTTPException(400, f"Binance Pay: {data.get('errorMessage', 'Lỗi tạo đơn')}")


async def _binance_webhook(request, db) -> dict:
    body_bytes = await request.body()
    body_str = body_bytes.decode()
    req_headers = request.headers

    timestamp = req_headers.get("BinancePay-Timestamp", "")
    nonce = req_headers.get("BinancePay-Nonce", "")
    received_sig = req_headers.get("BinancePay-Signature", "")

    if not hmac.compare_digest(_binance_sign(timestamp, nonce, body_str), received_sig):
        raise HTTPException(400, "Chữ ký Binance Pay không hợp lệ")

    body = json.loads(body_str)
    if body.get("bizStatus") != "PAY_SUCCESS":
        return {"returnCode": "SUCCESS", "returnMessage": None}

    biz_data = json.loads(body.get("data", "{}"))
    merchant_trade_no: str = biz_data.get("merchantTradeNo", "")

    # merchantTradeNo is UUID without dashes — reconstruct the UUID
    if len(merchant_trade_no) == 32:
        m = merchant_trade_no
        payment_id = f"{m[:8]}-{m[8:12]}-{m[12:16]}-{m[16:20]}-{m[20:]}"
        from app.billing.models import Payment as Pay

        pay = await db.get(Pay, payment_id)
        if pay:
            txn_id = biz_data.get("transactionId", merchant_trade_no)
            await mark_paid_and_activate(db, pay, txn_id)

    return {"returnCode": "SUCCESS", "returnMessage": None}


# ─── Public API ──────────────────────────────────────────────────────────────

async def create_payment_url(payment, user=None) -> dict:
    """Route to the correct provider based on payment.gateway."""
    if payment.gateway == "payos":
        if not settings.payos_client_id:
            raise HTTPException(503, "PayOS chưa được cấu hình — liên hệ admin")
        return await _payos_create(payment, user)
    if payment.gateway == "binance":
        if not settings.binance_api_key:
            raise HTTPException(503, "Binance Pay chưa được cấu hình — liên hệ admin")
        return await _binance_create(payment)
    raise HTTPException(400, "Phương thức thanh toán không hợp lệ")


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
        return  # webhook retry safety

    payment.status = "paid"
    payment.paid_at = datetime.now(timezone.utc).replace(tzinfo=None)
    if gateway_ref:
        payment.gateway_ref = gateway_ref

    user = await db.get(User, payment.user_id)
    if user:
        subscription.activate(user, payment.plan)
        plan_info = PLANS.get(payment.plan, {})
        assistant_count = int(plan_info.get("assistants", 0))
        if assistant_count > 0:
            await gift_assistants_if_eligible(db, user.id, payment.id, assistant_count)

    await db.commit()
