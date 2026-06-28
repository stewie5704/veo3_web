"""Gửi email qua Resend HTTP API (không cần SMTP). Key/from đọc từ config (settings.* <- .env).

Fail-soft: nếu chưa cấu hình key hoặc Resend lỗi -> trả False, KHÔNG raise (caller best-effort,
không để việc gửi mail làm hỏng đăng ký).
"""
from __future__ import annotations

import logging

import httpx

from app.config import settings

log = logging.getLogger("veo3.email")

RESEND_URL = "https://api.resend.com/emails"


async def send_email(to: str, subject: str, html: str) -> bool:
    if not settings.resend_api_key:
        log.warning("RESEND_API_KEY chưa cấu hình — bỏ qua gửi mail tới %s", to)
        return False
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(
                RESEND_URL,
                headers={"Authorization": f"Bearer {settings.resend_api_key}"},
                json={"from": settings.email_from, "to": [to], "subject": subject, "html": html},
            )
        if r.status_code >= 300:
            log.warning("Resend gửi lỗi %s: %s", r.status_code, (r.text or "")[:300])
            return False
        return True
    except Exception as e:   # noqa: BLE001 — best-effort, không để lỗi mạng làm hỏng flow
        log.warning("Resend exception khi gửi tới %s: %s", to, e)
        return False


def _verify_html(code: str) -> str:
    grad = "linear-gradient(115deg,#F97316,#EC4899 56%,#A855F7)"
    return f"""\
<div style="margin:0;padding:32px 16px;background:#0e0b14;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
  <div style="max-width:440px;margin:0 auto;background:#171221;border:1px solid #2a2440;border-radius:18px;overflow:hidden">
    <div style="height:4px;background:{grad}"></div>
    <div style="padding:30px 30px 34px">
      <div style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">AI AutoCut</div>
      <div style="font-size:13px;color:#9b93ad;margin-bottom:22px">Xác minh địa chỉ email của bạn</div>
      <div style="font-size:14px;color:#cfc8db;line-height:1.6;margin-bottom:18px">
        Nhập mã bên dưới vào trang đăng ký để kích hoạt tài khoản:
      </div>
      <div style="text-align:center;margin:0 0 18px">
        <div style="display:inline-block;font-size:34px;font-weight:800;letter-spacing:10px;color:#fff;
          background:#0e0b14;border:1px solid #2a2440;border-radius:14px;padding:16px 24px 16px 34px">{code}</div>
      </div>
      <div style="font-size:12.5px;color:#7e7790;line-height:1.6">
        Mã có hiệu lực trong <b style="color:#cfc8db">15 phút</b>. Nếu bạn không tạo tài khoản AI AutoCut, bỏ qua email này.
      </div>
    </div>
  </div>
  <div style="max-width:440px;margin:14px auto 0;text-align:center;font-size:11px;color:#5b566b">
    © AI AutoCut · app.aiautocut.com
  </div>
</div>"""


async def send_verification_email(to: str, code: str) -> bool:
    return await send_email(to, f"{code} là mã xác minh AI AutoCut", _verify_html(code))
