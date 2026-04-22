from __future__ import annotations

from datetime import datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo

from app.core.config import settings


def _parse_window_time(value: str) -> time:
    hour, minute = (int(part) for part in value.split(":", 1))
    return time(hour=hour, minute=minute)


def is_within_calling_window(
    timezone_name: str,
    *,
    reference_time: datetime | None = None,
) -> bool:
    client_tz = ZoneInfo(timezone_name)
    now_utc = reference_time or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(client_tz)
    local_time = local_now.timetz().replace(tzinfo=None)

    start_time = _parse_window_time(settings.calling_window_start)
    end_time = _parse_window_time(settings.calling_window_end)
    return start_time <= local_time <= end_time


def next_call_window_start(
    timezone_name: str,
    *,
    reference_time: datetime | None = None,
) -> datetime:
    client_tz = ZoneInfo(timezone_name)
    now_utc = reference_time or datetime.now(timezone.utc)
    local_now = now_utc.astimezone(client_tz)

    start_time = _parse_window_time(settings.calling_window_start)
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
) -> datetime:
    """
    Ensure a timestamp lands within the client's allowed local calling window.
    If it falls outside the window, move it to the next valid window start.
    """
    if is_within_calling_window(timezone_name, reference_time=scheduled_time_utc):
        return scheduled_time_utc
    return next_call_window_start(timezone_name, reference_time=scheduled_time_utc)
