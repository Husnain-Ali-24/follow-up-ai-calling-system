from pydantic import BaseModel, ConfigDict, field_validator


def _validate_window_time(value: str) -> str:
    try:
        hour_text, minute_text = value.split(":", 1)
        hour = int(hour_text)
        minute = int(minute_text)
    except (AttributeError, ValueError) as exc:
        raise ValueError("Time must use HH:MM format") from exc

    if hour < 0 or hour > 23 or minute < 0 or minute > 59:
        raise ValueError("Time must use HH:MM format")

    return f"{hour:02d}:{minute:02d}"


class SettingsResponse(BaseModel):
    calling_window_start: str
    calling_window_end: str

    model_config = ConfigDict(from_attributes=True)


class SettingsUpdate(BaseModel):
    calling_window_start: str
    calling_window_end: str

    @field_validator("calling_window_start", "calling_window_end")
    @classmethod
    def validate_window_time(cls, value: str) -> str:
        return _validate_window_time(value)
