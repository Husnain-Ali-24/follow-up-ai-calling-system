from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from app.models.call import CallStatus, SentimentType


class CallResponse(BaseModel):
    id: UUID
    client_id: UUID
    vapi_call_id: Optional[str]
    attempt_number: int
    status: CallStatus
    started_at: Optional[datetime]
    ended_at: Optional[datetime]
    duration_seconds: Optional[int]
    transcript: Optional[str]
    summary: Optional[str]
    structured_answers: Optional[dict[str, Any]]
    sentiment: Optional[SentimentType]
    recording_url: Optional[str]
    error_message: Optional[str]
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CallListItem(BaseModel):
    call_id: str
    client_id: str
    client_name: str
    client_phone: str
    vapi_call_id: Optional[str]
    attempt_number: int
    status: str
    sentiment: Optional[str]
    duration_seconds: int
    started_at: datetime
    ended_at: Optional[datetime]
    recording_url: Optional[str]
    created_at: datetime


class CallDetailResponse(CallListItem):
    transcript: Optional[str]
    summary: Optional[str]
    structured_answers: Optional[dict[str, Any]]
    error_message: Optional[str]


class CallEventResponse(BaseModel):
    event_id: str
    type: str
    timestamp: datetime
    description: str


class CallListResponse(BaseModel):
    items: list[CallListItem]
    total: int
    page: int
    per_page: int
    pages: int
