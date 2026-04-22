from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.interactors.settings import get_or_create_app_settings, update_app_settings
from app.models.user import User
from app.routes.auth import get_authenticated_user
from app.schemas.settings import SettingsResponse, SettingsUpdate


router = APIRouter(prefix="/settings", tags=["settings"])


def _require_admin(user: User) -> User:
    if not user.is_superuser:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admin users can manage system settings",
        )
    return user


@router.get("/", response_model=SettingsResponse)
def read_settings(
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_authenticated_user)],
):
    _require_admin(current_user)
    return get_or_create_app_settings(db)


@router.put("/", response_model=SettingsResponse)
def save_settings(
    payload: SettingsUpdate,
    db: Annotated[Session, Depends(get_db)],
    current_user: Annotated[User, Depends(get_authenticated_user)],
):
    _require_admin(current_user)
    try:
        return update_app_settings(db, payload)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
