import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat

from app.core.config import settings
from app.services.us_area_code_timezones import (
    DEFAULT_NANP_TIMEZONE,
    NANP_AREA_CODE_TIMEZONES,
)

try:
    from phonenumbers.timezone import time_zones_for_number
except ModuleNotFoundError:
    time_zones_for_number = None


def _parse_phone_number(phone_number: str, default_region: str | None = None):
    raw_value = (phone_number or "").strip()
    if not raw_value:
        return None

    region = default_region or settings.default_phone_region
    try:
        parsed_number = phonenumbers.parse(raw_value, region)
    except NumberParseException:
        return None

    if not phonenumbers.is_valid_number(parsed_number):
        return None

    return parsed_number


def _infer_timezone_from_phonenumbers_dataset(parsed_number) -> str | None:
    if time_zones_for_number is None:
        return None

    candidate_timezones = [
        timezone_name
        for timezone_name in time_zones_for_number(parsed_number)
        if timezone_name and timezone_name != "Etc/Unknown"
    ]
    return candidate_timezones[0] if candidate_timezones else None


def _infer_timezone_from_nanp_area_code(parsed_number) -> str | None:
    if getattr(parsed_number, "country_code", None) != 1:
        return None

    national_number = str(parsed_number.national_number)
    if len(national_number) < 3:
        return DEFAULT_NANP_TIMEZONE

    area_code = national_number[:3]
    return NANP_AREA_CODE_TIMEZONES.get(area_code, DEFAULT_NANP_TIMEZONE)


def normalize_phone_number(phone_number: str, default_region: str | None = None) -> str:
    """
    Normalize inbound phone numbers into E.164 so they are safe for uniqueness
    checks and ready to send to Vapi.

    Examples:
    - "(415) 555-2671"      -> +14155552671
    - "+1 415 555 2671"     -> +14155552671
    - "415.555.2671"        -> +14155552671 (using default region)
    """
    raw_value = (phone_number or "").strip()
    if not raw_value:
        raise ValueError("Phone number is required")

    region = default_region or settings.default_phone_region
    try:
        parsed_number = phonenumbers.parse(raw_value, region)
    except NumberParseException as exc:
        raise ValueError("Phone number could not be parsed") from exc

    if not phonenumbers.is_valid_number(parsed_number):
        raise ValueError("Phone number is not valid")

    return phonenumbers.format_number(parsed_number, PhoneNumberFormat.E164)


def infer_timezone_from_phone_number(phone_number: str, default_region: str | None = None) -> str | None:
    parsed_number = _parse_phone_number(phone_number, default_region)
    if parsed_number is None:
        return None

    inferred_timezone = _infer_timezone_from_phonenumbers_dataset(parsed_number)
    if inferred_timezone:
        return inferred_timezone

    return _infer_timezone_from_nanp_area_code(parsed_number)
