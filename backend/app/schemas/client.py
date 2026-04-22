from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from pydantic import field_validator
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from app.models.client import ClientStatus
from app.services.phone_numbers import normalize_phone_number

class ClientBase(BaseModel):
    full_name: str = Field(..., description="Client's full name")
    phone_number: str = Field(..., description="Client's phone number in E.164 format")
    email: Optional[EmailStr] = Field(None, description="Client's email address")
    follow_up_context: str = Field(..., description="Context for the follow-up call")
    previous_interaction: Optional[str] = Field(None, description="Notes on previous interaction")
    scheduled_call_time: Optional[datetime] = Field(None, description="When to call the client")
    timezone: str = Field("UTC", description="Client's timezone")
    notes: Optional[str] = Field(None, description="Operator notes")
    custom_fields: Dict[str, Any] = Field(default_factory=dict, description="Custom mapped fields from import")

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: str) -> str:
        # Strip all non-numeric characters except '+'
        digits = "".join(filter(lambda x: x.isdigit() or x == '+', value))
        
        # If it doesn't start with +, but looks like an international number (length > 10)
        # or starts with common country codes, add the +
        if not digits.startswith('+'):
            if len(digits) >= 10:
                digits = '+' + digits
        
        # Basic check for minimum length
        if len(digits) < 8:
            raise ValueError("Phone number is too short")
            
        return normalize_phone_number(digits)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: str) -> str:
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone, e.g. Asia/Karachi") from exc
        return value

class ClientCreate(ClientBase):
    pass

class ClientImport(ClientBase):
    pass

class ClientUpdate(BaseModel):
    full_name: Optional[str] = None
    phone_number: Optional[str] = None
    email: Optional[EmailStr] = None
    follow_up_context: Optional[str] = None
    previous_interaction: Optional[str] = None
    scheduled_call_time: Optional[datetime] = None
    timezone: Optional[str] = None
    status: Optional[ClientStatus] = None
    notes: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None

    @field_validator("phone_number")
    @classmethod
    def validate_phone_number(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        return normalize_phone_number(value)

    @field_validator("timezone")
    @classmethod
    def validate_timezone(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        try:
            ZoneInfo(value)
        except ZoneInfoNotFoundError as exc:
            raise ValueError("Timezone must be a valid IANA timezone, e.g. Asia/Karachi") from exc
        return value

class ClientResponse(ClientBase):
    id: UUID
    status: ClientStatus
    is_active: bool
    reschedule_count: int
    last_call_attempt_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
