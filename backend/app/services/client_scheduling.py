from __future__ import annotations

from datetime import datetime, timezone
from zoneinfo import ZoneInfo

from app.services.calling_window import (
    CallingWindow,
    align_to_calling_window,
    is_within_calling_window,
    next_call_window_start,
)
from app.services.phone_numbers import infer_timezone_from_phone_number


def resolve_lead_timezone(phone_number: str, provided_timezone: str | None) -> str:
    normalized_timezone = (provided_timezone or "").strip()
    if normalized_timezone:
        return normalized_timezone

    inferred_timezone = infer_timezone_from_phone_number(phone_number)
    if inferred_timezone:
        return inferred_timezone

    return "UTC"


def resolve_scheduled_call_time(
    *,
    scheduled_call_time: datetime | None,
    timezone_name: str,
    call_window: CallingWindow,
    reference_time: datetime | None = None,
) -> datetime:
    if scheduled_call_time is None:
        candidate_time = reference_time or datetime.now(timezone.utc)
        if is_within_calling_window(
            timezone_name,
            reference_time=candidate_time,
            call_window=call_window,
        ):
            return candidate_time

        return next_call_window_start(
            timezone_name,
            reference_time=candidate_time,
            call_window=call_window,
        )

    if scheduled_call_time.tzinfo is None:
        candidate_time = scheduled_call_time.replace(
            tzinfo=ZoneInfo(timezone_name)
        ).astimezone(timezone.utc)
    else:
        candidate_time = scheduled_call_time.astimezone(timezone.utc)

    return align_to_calling_window(
        candidate_time,
        timezone_name,
        call_window=call_window,
    )
