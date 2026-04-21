import jwt
from fastapi import HTTPException, status

from app.core.security import create_access_token, decode_access_token


def build_auth_response(user) -> dict:
    return {
        "access_token": create_access_token(subject=str(user.id)),
        "token_type": "bearer",
        "user": user,
    }


def parse_token_subject(token: str) -> int:
    try:
        payload = decode_access_token(token)
        subject = payload.get("sub")
        if subject is None:
            raise ValueError("Missing token subject")
        return int(subject)
    except (jwt.InvalidTokenError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
        ) from exc
