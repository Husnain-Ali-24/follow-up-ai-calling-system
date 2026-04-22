from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.app_settings import AppSettings
from app.schemas.settings import SettingsUpdate


def get_or_create_app_settings(db: Session) -> AppSettings:
    app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
    if app_settings is None:
        app_settings = AppSettings(
            id=1,
            calling_window_start=settings.calling_window_start,
            calling_window_end=settings.calling_window_end,
        )
        db.add(app_settings)
        db.commit()
        db.refresh(app_settings)

    return app_settings


def update_app_settings(db: Session, payload: SettingsUpdate) -> AppSettings:
    start_time = payload.calling_window_start
    end_time = payload.calling_window_end
    if start_time >= end_time:
        raise ValueError("Calling window start must be earlier than the end time")

    app_settings = get_or_create_app_settings(db)
    app_settings.calling_window_start = start_time
    app_settings.calling_window_end = end_time
    db.commit()
    db.refresh(app_settings)
    return app_settings
