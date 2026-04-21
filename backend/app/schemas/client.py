from datetime import datetime
from typing import Optional, Dict, Any, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from uuid import UUID
from app.models.client import ClientStatus

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

class ClientResponse(ClientBase):
    id: UUID
    status: ClientStatus
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)
