"""Symmetric encryption for secrets at rest (Google cookies, Gemini API key).

Key is derived from SECRET_KEY, so rotating SECRET_KEY invalidates stored ciphertext —
that's fine: `dec()` falls back to returning the value as-is, so the user just reconnects
(re-saving a fresh, freshly-encrypted secret). Legacy plaintext rows decrypt to themselves.
"""
from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet

from app.config import settings

log = logging.getLogger("veo3.crypto")


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def enc(value: str | None) -> str | None:
    """Encrypt a secret for storage. Returns None/empty unchanged."""
    if not value:
        return value
    try:
        return _fernet().encrypt(value.encode()).decode()
    except Exception as e:  # noqa: BLE001
        log.warning("encrypt failed, storing as-is: %s", e)
        return value


def dec(value: str | None) -> str | None:
    """Decrypt a stored secret. Plaintext (pre-encryption) values pass through unchanged."""
    if not value:
        return value
    try:
        return _fernet().decrypt(value.encode()).decode()
    except Exception:  # noqa: BLE001 — not a valid token => legacy plaintext
        return value
