from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.call import Call, Reschedule
from app.models.client import Client, ClientStatus
from app.services.calling_window import CallingWindow, is_within_calling_window


@dataclass(frozen=True)
class SlotAvailabilityResult:
    is_available: bool
    reason: str
    lead_timezone: str
    requested_local_iso: str | None
    requested_utc_iso: str | None
    window_start: str
    window_end: str


@dataclass(frozen=True)
class RescheduleBookingResult:
    success: bool
    reason: str
    lead_timezone: str
    scheduled_local_iso: str | None
    scheduled_utc_iso: str | None
    reschedule_count: int


def _safe_timezone_name(timezone_name: str | None, fallback: str = "UTC") -> str:
    if not timezone_name:
        return fallback

    value = timezone_name.strip()
    if not value:
        return fallback

    try:
        ZoneInfo(value)
    except ZoneInfoNotFoundError:
        return fallback
    return value


def parse_callback_datetime(
    raw_value: str | None,
    timezone_name: str,
) -> datetime | None:
    if not raw_value:
        return None

    normalized_value = raw_value.strip()
    if not normalized_value:
        return None

    # Common Vapi formats can include ' ' instead of 'T'
    normalized_value = normalized_value.replace(" ", "T")
    
    # Handle 'Z' suffix
    if normalized_value.endswith("Z"):
        normalized_value = normalized_value[:-1] + "+00:00"

    # Try parsing several variations
    for fmt in (None, "%Y-%m-%dT%H:%M:%S", "%Y-%m-%dT%H:%M:%S.%f"):
        try:
            if fmt is None:
                parsed = datetime.fromisoformat(normalized_value)
            else:
                parsed = datetime.strptime(normalized_value, fmt)
            break
        except (ValueError, TypeError):
            continue
    else:
        # Final attempt: just try the first 19 chars if it's long
        if len(normalized_value) > 19:
            try:
                parsed = datetime.fromisoformat(normalized_value[:19])
            except (ValueError, TypeError):
                return None
        else:
            return None

    try:
        target_tz = ZoneInfo(timezone_name)
    except ZoneInfoNotFoundError:
        target_tz = timezone.utc

    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=target_tz)
    else:
        parsed = parsed.astimezone(target_tz)

    return parsed.astimezone(timezone.utc)


def check_slot_availability(
    *,
    lead_timezone: str | None,
    requested_callback_time: str | None,
    call_window: CallingWindow,
    reference_time: datetime | None = None,
) -> SlotAvailabilityResult:
    timezone_name = _safe_timezone_name(lead_timezone)
    requested_utc = parse_callback_datetime(
        requested_callback_time,
        timezone_name,
    )

    if requested_utc is None:
        return SlotAvailabilityResult(
            is_available=False,
            reason="invalid_datetime_format",
            lead_timezone=timezone_name,
            requested_local_iso=None,
            requested_utc_iso=None,
            window_start=call_window.start_text,
            window_end=call_window.end_text,
        )

    now_utc = reference_time or datetime.now(timezone.utc)
    if requested_utc <= now_utc:
        requested_local = requested_utc.astimezone(ZoneInfo(timezone_name))
        return SlotAvailabilityResult(
            is_available=False,
            reason="requested_time_in_past",
            lead_timezone=timezone_name,
            requested_local_iso=requested_local.isoformat(),
            requested_utc_iso=requested_utc.isoformat(),
            window_start=call_window.start_text,
            window_end=call_window.end_text,
        )

    requested_local = requested_utc.astimezone(ZoneInfo(timezone_name))
    if not is_within_calling_window(
        timezone_name,
        reference_time=requested_utc,
        call_window=call_window,
    ):
        return SlotAvailabilityResult(
            is_available=False,
            reason="outside_calling_window",
            lead_timezone=timezone_name,
            requested_local_iso=requested_local.isoformat(),
            requested_utc_iso=requested_utc.isoformat(),
            window_start=call_window.start_text,
            window_end=call_window.end_text,
        )

    return SlotAvailabilityResult(
        is_available=True,
        reason="available",
        lead_timezone=timezone_name,
        requested_local_iso=requested_local.isoformat(),
        requested_utc_iso=requested_utc.isoformat(),
        window_start=call_window.start_text,
        window_end=call_window.end_text,
    )


def book_reschedule(
    db: Session,
    *,
    client: Client,
    call: Call | None,
    confirmed_datetime: str | None,
    reason: str | None,
    lead_timezone: str | None,
    call_window: CallingWindow,
    reference_time: datetime | None = None,
) -> RescheduleBookingResult:
    timezone_name = _safe_timezone_name(lead_timezone, fallback=client.timezone)
    slot_check = check_slot_availability(
        lead_timezone=timezone_name,
        requested_callback_time=confirmed_datetime,
        call_window=call_window,
        reference_time=reference_time,
    )

    if not slot_check.is_available:
        return RescheduleBookingResult(
            success=False,
            reason=slot_check.reason,
            lead_timezone=slot_check.lead_timezone,
            scheduled_local_iso=slot_check.requested_local_iso,
            scheduled_utc_iso=slot_check.requested_utc_iso,
            reschedule_count=client.reschedule_count,
        )

    if client.reschedule_count >= settings.max_reschedule_count:
        client.status = ClientStatus.MANUAL_FOLLOW_UP_REQUIRED
        return RescheduleBookingResult(
            success=False,
            reason="max_reschedules_reached",
            lead_timezone=timezone_name,
            scheduled_local_iso=slot_check.requested_local_iso,
            scheduled_utc_iso=slot_check.requested_utc_iso,
            reschedule_count=client.reschedule_count,
        )

    requested_utc = parse_callback_datetime(confirmed_datetime, timezone_name)
    if requested_utc is None:
        return RescheduleBookingResult(
            success=False,
            reason="invalid_datetime_format",
            lead_timezone=timezone_name,
            scheduled_local_iso=None,
            scheduled_utc_iso=None,
            reschedule_count=client.reschedule_count,
        )

    original_time = client.scheduled_call_time or (reference_time or datetime.now(timezone.utc))
    db.add(
        Reschedule(
            client_id=client.id,
            call_id=call.id if call is not None else None,
            original_time=original_time,
            new_time=requested_utc,
            reason=reason,
        )
    )

    client.timezone = timezone_name
    client.scheduled_call_time = requested_utc
    client.reschedule_count += 1
    client.status = ClientStatus.RESCHEDULED

    scheduled_local_iso = requested_utc.astimezone(ZoneInfo(timezone_name)).isoformat()
    return RescheduleBookingResult(
        success=True,
        reason="rescheduled",
        lead_timezone=timezone_name,
        scheduled_local_iso=scheduled_local_iso,
        scheduled_utc_iso=requested_utc.isoformat(),
        reschedule_count=client.reschedule_count,
    )
