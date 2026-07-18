"""Shared security utilities: path safety, host allowlists, rate limiting, HMAC share links.

Import từ các router thay vì tự viết lại — đảm bảo cùng 1 kiểm tra ở mọi endpoint.
"""
from __future__ import annotations

import hmac
import hashlib
import ipaddress
import os
import re
import socket
import sys
import time
from collections import defaultdict, deque
from pathlib import Path
from urllib.parse import urlparse

from fastapi import HTTPException

from app.config import settings

# ─────────────────────────── Path safety ────────────────────────────────────
# Chỉ nhận chữ, số, dấu . _ - và không được chứa `..`. Không dùng regex
# permissive — bất kỳ ký tự lạ nào (kể cả `/`, null byte, unicode direction
# markers) đều đá thẳng. Đây là hàng rào ĐẦU TIÊN, resolve() là hàng rào thứ 2.
_SAFE_NAME_RE = re.compile(r"^[A-Za-z0-9._-]{1,180}$")


def safe_filename(name: str) -> str:
    """Reject anything that could path-traverse or hit an unexpected path.
    Trả về chính chuỗi nếu hợp lệ; raise HTTPException(400) nếu không.
    """
    n = (name or "").strip()
    if not n or n == "." or ".." in n or "/" in n or "\\" in n or "\x00" in n:
        raise HTTPException(400, "Tên file không hợp lệ")
    if not _SAFE_NAME_RE.match(n):
        raise HTTPException(400, "Tên file không hợp lệ")
    return n


def safe_join(base: Path, name: str) -> Path:
    """Ghép base/name và xác nhận kết quả nằm trong base (chống symlink escape).
    Dùng cho mọi endpoint nhận tên file từ client.
    """
    name = safe_filename(name)
    base = base.resolve()
    p = (base / name).resolve()
    # `is_relative_to` có từ Python 3.9 — VPS đang 3.10/3.11 nên OK.
    if not p.is_relative_to(base):
        raise HTTPException(400, "Đường dẫn không hợp lệ")
    return p


# Alias tên đọc rõ nghĩa cho media router.
def check_media_filename(name: str) -> str:
    """Xác nhận tên file media hợp lệ (không path-traversal). = safe_filename."""
    return safe_filename(name)


def resolve_within(base: Path, name: str) -> Path:
    """Resolve base/name và bảo đảm nằm trong base. = safe_join."""
    return safe_join(base, name)


# ─────────────────────────── Subprocess helpers ─────────────────────────────
# Chạy ffmpeg / yt-dlp có timeout + LUÔN kill khi timeout (không để zombie).
# Trả (returncode, stdout, stderr) — stderr chỉ dùng để log, KHÔNG echo ra client.

async def _run_proc(argv: list[str], timeout: float) -> tuple[int, str, str]:
    import asyncio
    proc = await asyncio.create_subprocess_exec(
        *argv,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    try:
        out, err = await asyncio.wait_for(proc.communicate(), timeout=timeout)
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except ProcessLookupError:
            pass
        try:
            await asyncio.wait_for(proc.communicate(), timeout=5)
        except Exception:  # noqa: BLE001
            pass
        return (124, "", f"timeout after {timeout}s")
    return (proc.returncode or 0,
            (out or b"").decode(errors="replace"),
            (err or b"").decode(errors="replace"))


async def ffmpeg_run(args: list[str], timeout: float = 300) -> tuple[int, str, str]:
    """Chạy `ffmpeg <args>` an toàn (timeout + kill). args KHÔNG gồm 'ffmpeg'."""
    return await _run_proc(["ffmpeg", *args], timeout)


async def yt_dlp_run(args: list[str], timeout: float = 300) -> tuple[int, str, str]:
    """Chạy `yt-dlp <args>` an toàn (timeout + kill). args KHÔNG gồm 'yt-dlp'."""
    # Dùng đúng Python đang chạy app để luôn tìm thấy package trong backend/venv.
    return await _run_proc([sys.executable, "-m", "yt_dlp", *args], timeout)


# ─────────────────────────── SSRF-safe hosts ────────────────────────────────

def host_is_public(host: str) -> bool:
    """Phân giải host qua DNS, chối nếu bất kỳ record nào trỏ vào IP riêng/loopback.
    Nên gọi ở MỖI hop redirect (attacker có thể trỏ Location: về 169.254.169.254).
    """
    if not host:
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        try:
            addr = ipaddress.ip_address(info[4][0].split("%")[0])
        except ValueError:
            return False
        if (addr.is_private or addr.is_loopback or addr.is_link_local
                or addr.is_reserved or addr.is_multicast or addr.is_unspecified):
            return False
    return True


def require_public_http_url(url: str) -> str:
    """Xác nhận URL là http(s) và host trỏ vào IP public. Raise HTTPException(400) nếu không."""
    p = urlparse(url or "")
    if p.scheme not in ("http", "https") or not p.hostname:
        raise HTTPException(400, "URL không hợp lệ")
    if not host_is_public(p.hostname):
        raise HTTPException(400, "URL không hợp lệ (trỏ tới địa chỉ nội bộ)")
    return url


# ─────────────────────────── Rate limit (in-memory) ─────────────────────────
# Đủ cho single-node uvicorn (VPS hiện tại). Nếu scale >1 process nên chuyển
# sang Redis, nhưng ngay tại đây đã đủ chặn brute-force + spam yt-dlp.

_buckets: dict[str, deque[float]] = defaultdict(deque)
_MAX_BUCKETS = 20_000

# Cho phép TẮT rate-limit trong test/CI (đặt DISABLE_RATE_LIMIT=1). Prod KHÔNG set biến này.
_RL_DISABLED = os.getenv("DISABLE_RATE_LIMIT", "").lower() in ("1", "true", "yes")


def rate_limit(key: str, limit: int, window: float) -> None:
    """Sliding-window; raise HTTPException(429) nếu vượt `limit` sự kiện trong `window` giây.
    Ví dụ: rate_limit(f"login:{ip}", limit=10, window=60) -> tối đa 10 lần/phút.
    """
    if _RL_DISABLED:
        return
    now = time.monotonic()
    if key not in _buckets and len(_buckets) >= _MAX_BUCKETS:
        # Chặn tăng RAM vô hạn khi attacker tạo nhiều key/IP/email khác nhau.
        stale = [k for k, values in _buckets.items()
                 if not values or now - values[-1] > 3600]
        for stale_key in stale:
            _buckets.pop(stale_key, None)
        if len(_buckets) >= _MAX_BUCKETS:
            raise HTTPException(429, "Hệ thống đang nhận quá nhiều yêu cầu, thử lại sau.")
    dq = _buckets[key]
    while dq and now - dq[0] > window:
        dq.popleft()
    if len(dq) >= limit:
        raise HTTPException(429, "Bạn thao tác quá nhanh, thử lại sau ít phút.")
    dq.append(now)


def client_ip(request) -> str:
    """Lấy IP client đã chuẩn hoá.

    Nginx dùng `$proxy_add_x_forwarded_for`, nên phần tử cuối là IP mà nginx thực sự
    nhìn thấy. Không lấy phần tử đầu vì client có thể tự chèn X-Forwarded-For giả.
    """
    xff = request.headers.get("x-forwarded-for", "")
    peer = getattr(request.client, "host", "") or ""
    candidate = xff.split(",")[-1].strip() if xff else peer
    try:
        return str(ipaddress.ip_address(candidate.split("%")[0]))
    except ValueError:
        try:
            return str(ipaddress.ip_address(peer.split("%")[0]))
        except ValueError:
            return "unknown"


# ─────────────────────────── HMAC share tokens ──────────────────────────────
# Thay dict in-memory (mất khi restart, không share giữa worker) bằng token
# stateless: base64url(payload).base64url(hmac). Payload gồm video_file + exp.

def _b64u(b: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(b).rstrip(b"=").decode()


def _b64u_dec(s: str) -> bytes:
    import base64
    pad = "=" * (-len(s) % 4)
    return base64.urlsafe_b64decode(s + pad)


def make_share_token(video_file: str, ttl_seconds: int = 7 * 24 * 3600) -> str:
    """HMAC-signed share token: file + expiry. Không cần state server-side."""
    safe_filename(video_file)   # từ chối tên nguy hiểm ngay tại thời điểm cấp
    exp = int(time.time()) + int(ttl_seconds)
    payload = f"{video_file}|{exp}".encode()
    sig = hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).digest()
    return f"{_b64u(payload)}.{_b64u(sig)}"


def verify_share_token(token: str) -> str:
    """Return video_file if valid & not expired, else raise HTTPException(404).
    Dùng 404 để không leak thông tin xem token có tồn tại hay không.
    """
    if not token or len(token) > 2048:
        raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    try:
        p_b64, s_b64 = token.split(".", 1)
        payload = _b64u_dec(p_b64)
        sig = _b64u_dec(s_b64)
    except Exception:
        raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    expect = hmac.new(settings.secret_key.encode(), payload, hashlib.sha256).digest()
    if not hmac.compare_digest(sig, expect):
        raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    try:
        video_file, exp_s = payload.decode().rsplit("|", 1)
        if int(exp_s) < int(time.time()):
            raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(404, "Link không hợp lệ hoặc đã hết hạn")
    safe_filename(video_file)   # phòng khi cấp trước lúc siết safe_filename
    return video_file
