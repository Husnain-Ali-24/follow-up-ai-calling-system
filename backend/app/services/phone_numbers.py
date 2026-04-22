import phonenumbers
from phonenumbers import NumberParseException, PhoneNumberFormat

from app.core.config import settings


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
