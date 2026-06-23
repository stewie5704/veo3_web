"""Unit: secrets-at-rest encryption (app/crypto.py)."""
from app.crypto import enc, dec


def test_roundtrip():
    s = "__Secure-next-auth.session-token=abc123; email=x%40y.com"
    c = enc(s)
    assert c != s and c.startswith("gAAAA")   # Fernet token
    assert dec(c) == s


def test_legacy_plaintext_passthrough():
    # pre-encryption rows must still be readable
    assert dec("plain-old-cookie-string") == "plain-old-cookie-string"


def test_empty_and_none():
    assert enc("") == "" and dec("") == ""
    assert enc(None) is None and dec(None) is None
