from __future__ import annotations

import hashlib
import hmac

from fastapi import Request

from app.core.config import settings


def _build_expected_signature(body: bytes) -> str:
    digest = hmac.new(
        settings.vapi_webhook_secret.encode("utf-8"),
        body,
        hashlib.sha256,
    ).hexdigest()
    return digest


def verify_vapi_request(request: Request, body: bytes) -> bool:
    """
    Support the common Vapi server auth patterns:
    - HMAC signature via `X-Vapi-Signature`
    - Shared secret via `X-Vapi-Secret`
    - Bearer auth via `Authorization`
    If no webhook secret is configured, accept the request.
    """
    configured_secret = settings.vapi_webhook_secret
    if not configured_secret:
        return True

    signature = request.headers.get("x-vapi-signature", "").strip()
    if signature:
        expected = _build_expected_signature(body)
        candidates = {
            expected,
            f"sha256={expected}",
        }
        if any(hmac.compare_digest(signature, candidate) for candidate in candidates):
            return True

    header_secret = request.headers.get("x-vapi-secret", "").strip()
    if header_secret and hmac.compare_digest(header_secret, configured_secret):
        return True

    authorization = request.headers.get("authorization", "").strip()
    if authorization.lower().startswith("bearer "):
        token = authorization[7:].strip()
        if token and hmac.compare_digest(token, configured_secret):
            return True

    return False
