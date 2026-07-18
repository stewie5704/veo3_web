"""Symmetric encryption for secrets at rest (Google cookies, Gemini API key).

Key is derived from SECRET_KEY. Rotating SECRET_KEY invalidates stored ciphertext — the
user reconnects and a fresh, freshly-encrypted secret replaces the old one.

Security model:
  - Values that LOOK like a Fernet token (prefix "gAAAAA...") MUST decrypt correctly.
    If they don't, we raise — never fall back to the raw ciphertext string (that would
    let a value in the DB be interpreted as plaintext just because the key rotated or
    the row was tampered with).
  - Values that don't look like a Fernet token at all pass through as legacy plaintext.
    Old rows written before encryption was introduced still readable.
"""
from __future__ import annotations

import base64
import hashlib
import logging

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings

log = logging.getLogger("veo3.crypto")

# Fernet tokens are urlsafe-b64 of a byte string starting with version byte 0x80,
# which encodes to "gAAAAA" at the start of every real token. Cheap, deterministic
# discriminator between "encrypted blob" and "raw string a caller once inserted".
_FERNET_PREFIX = "gAAAAA"


def _fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.secret_key.encode()).digest())
    return Fernet(key)


def enc(value: str | None) -> str | None:
    """Encrypt a secret for storage. Returns None/empty unchanged."""
    if not value:
        return value
    return _fernet().encrypt(value.encode()).decode()


def dec(value: str | None) -> str | None:
    """Decrypt a stored secret. Legacy plaintext (pre-encryption) values pass through.
    A malformed Fernet token raises — never silently returns ciphertext-as-plaintext."""
    if not value:
        return value
    if not value.startswith(_FERNET_PREFIX):
        # Legacy plaintext row (predates encryption). Return as-is.
        return value
    try:
        return _fernet().decrypt(value.encode()).decode()
    except InvalidToken:
        # Real Fernet-shaped token that we can't decrypt — key rotated OR tampering.
        # Fail closed rather than expose the ciphertext to callers who expect plaintext.
        log.error("crypto.dec: invalid/expired Fernet token, refusing to return as plaintext")
        raise
