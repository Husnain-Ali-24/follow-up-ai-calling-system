from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings
from app.models.app_settings import AppSettings


@dataclass(frozen=True)
class CallingWindow:
    start: time
    end: time
    start_text: str
    end_text: str


def _parse_window_time(value: str) -> time:
    hour, minute = (int(part) for part in value.split(":", 1))
    return time(hour=hour, minute=minute)


def get_effective_calling_window(db=None) -> CallingWindow:
    start_text = settings.calling_window_start
    end_text = settings.calling_window_end

    if db is not None:
        app_settings = db.query(AppSettings).filter(AppSettings.id == 1).first()
        if app_settings is not None:
            start_text = app_settings.calling_window_start
            end_text = app_settings.calling_window_end

    return CallingWindow(
        start=_parse_window_time(start_text),
        end=_parse_window_time(end_text),
        start_text=start_text,
        end_text=end_text,
    )


def is_within_calling_window(
    timezone_name: str,
    *,
    reference_time: datetime | None = None,
    call_window: CallingWindow | None = None,
) -> bool:
    client_tz = ZoneInfo(timezone_name)
    now_utc = reference_time or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(client_tz)
    local_time = local_now.timetz().replace(tzinfo=None)

    window = call_window or get_effective_calling_window()
    return window.start <= local_time <= window.end


def next_call_window_start(
    timezone_name: str,
    *,
    reference_time: datetime | None = None,
    call_window: CallingWindow | None = None,
) -> datetime:
    client_tz = ZoneInfo(timezone_name)
    now_utc = reference_time or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(client_tz)

    window = call_window or get_effective_calling_window()
    start_time = window.start
    local_start_today = local_now.replace(
        hour=start_time.hour,
        minute=start_time.minute,
        second=0,
        microsecond=0,
    )

    if local_now <= local_start_today:
        target_local = local_start_today
    else:
        target_local = local_start_today + timedelta(days=1)

    return target_local.astimezone(timezone.utc)


def align_to_calling_window(
    scheduled_time_utc: datetime,
    timezone_name: str,
    *,
    call_window: CallingWindow | None = None,
) -> datetime:
    """
    Ensure a timestamp lands within the client's allowed local calling window.
    If it falls outside the window, move it to the next valid window start.
    """
    if is_within_calling_window(
        timezone_name,
        reference_time=scheduled_time_utc,
        call_window=call_window,
    ):
        return scheduled_time_utc
    return next_call_window_start(
        timezone_name,
        reference_time=scheduled_time_utc,
        call_window=call_window,
    )
