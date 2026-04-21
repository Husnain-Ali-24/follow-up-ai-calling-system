from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.interactors.auth import (
    authenticate_user,
    get_current_user_by_id,
    register_user,
)
from app.schemas.auth import AuthResponse, LoginRequest, RegisterRequest, UserResponse
from app.services.token_service import build_auth_response, parse_token_subject


router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=True)


def get_authenticated_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(bearer_scheme)],
    db: Annotated[Session, Depends(get_db)],
):
    user_id = parse_token_subject(credentials.credentials)
    return get_current_user_by_id(db, user_id)


@router.post("/register", response_model=AuthResponse, status_code=201)
def register(
    payload: RegisterRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = register_user(
        db,
        email=payload.email,
        password=payload.password,
        full_name=payload.full_name,
    )
    return build_auth_response(user)


@router.post("/login", response_model=AuthResponse)
def login(
    payload: LoginRequest,
    db: Annotated[Session, Depends(get_db)],
):
    user = authenticate_user(
        db,
        email=payload.email,
        password=payload.password,
    )
    return build_auth_response(user)


@router.get("/me", response_model=UserResponse)
def get_me(current_user=Depends(get_authenticated_user)):
    return current_user
