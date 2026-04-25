from __future__ import annotations

from math import ceil
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.call import Call, CallStatus
from app.models.client import Client
from app.models.user import User
from app.routes.auth import get_authenticated_user
from app.schemas.call import CallDetailResponse, CallEventResponse, CallListItem, CallListResponse


router = APIRouter(prefix="/calls", tags=["calls"])


def _build_call_item(call: Call, client: Client | None) -> CallListItem:
    return CallListItem(
        call_id=str(call.id),
        client_id=str(call.client_id),
        client_name=client.full_name if client else "Unknown Client",
        client_phone=client.phone_number if client else "",
        vapi_call_id=call.vapi_call_id,
        attempt_number=call.attempt_number,
        status=call.status.value,
        sentiment=call.sentiment.value if call.sentiment else None,
        duration_seconds=call.duration_seconds or 0,
        started_at=call.started_at or call.created_at,
        ended_at=call.ended_at,
        recording_url=call.recording_url,
        created_at=call.created_at,
    )


def _build_call_detail(call: Call, client: Client | None) -> CallDetailResponse:
    base = _build_call_item(call, client)
    return CallDetailResponse(
        **base.model_dump(),
        transcript=call.transcript,
        summary=call.summary,
        structured_answers=call.structured_answers,
        error_message=call.error_message,
    )


def _build_call_events(call: Call, client: Client | None) -> list[CallEventResponse]:
    events: list[CallEventResponse] = []
    phone_number = client.phone_number if client else "unknown number"
    started_at = call.started_at or call.created_at

    events.append(
        CallEventResponse(
            event_id=f"{call.id}-dial",
            type="dial",
            timestamp=started_at,
            description=f"Outbound call initiated to {phone_number}",
        )
    )

    if call.status in {CallStatus.IN_PROGRESS, CallStatus.COMPLETED, CallStatus.REFUSED}:
        events.append(
            CallEventResponse(
                event_id=f"{call.id}-pickup",
                type="pickup",
                timestamp=started_at,
                description="Call connected",
            )
        )

    if call.transcript:
        events.append(
            CallEventResponse(
                event_id=f"{call.id}-transcript",
                type="ai_turn",
                timestamp=started_at,
                description="Transcript captured for this call",
            )
        )

    if call.status == CallStatus.COMPLETED and call.ended_at:
        events.append(
            CallEventResponse(
                event_id=f"{call.id}-end",
                type="end",
                timestamp=call.ended_at,
                description="Call ended successfully",
            )
        )
    elif call.status in {CallStatus.FAILED, CallStatus.NO_ANSWER, CallStatus.BUSY, CallStatus.VOICEMAIL} and call.ended_at:
        events.append(
            CallEventResponse(
                event_id=f"{call.id}-failed",
                type="failed",
                timestamp=call.ended_at,
                description=f"Call ended with outcome: {call.status.value.replace('_', ' ')}",
            )
        )
    elif call.status == CallStatus.REFUSED and call.ended_at:
        events.append(
            CallEventResponse(
                event_id=f"{call.id}-refused",
                type="end",
                timestamp=call.ended_at,
                description="Client refused the offer or follow-up",
            )
        )

    return events


@router.get("/", response_model=CallListResponse)
def list_calls(
    search: str | None = None,
    status: CallStatus | None = None,
    page: int = 1,
    per_page: int = 25,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    del current_user
    resolved_page = max(page, 1)
    resolved_per_page = min(max(per_page, 1), 100)

    query = db.query(Call, Client).outerjoin(Client, Client.id == Call.client_id)
    
    if status:
        query = query.filter(Call.status == status)

    if search:
        query = query.filter(
            or_(
                Client.full_name.ilike(f"%{search}%"),
                Client.phone_number.ilike(f"%{search}%"),
                Call.vapi_call_id.ilike(f"%{search}%"),
            )
        )

    total = query.count()
    pages = ceil(total / resolved_per_page) if total else 0
    results = (
        query.order_by(Call.started_at.desc().nullslast(), Call.created_at.desc())
        .offset((resolved_page - 1) * resolved_per_page)
        .limit(resolved_per_page)
        .all()
    )
    return {
        "items": [_build_call_item(call, client) for call, client in results],
        "total": total,
        "page": resolved_page,
        "per_page": resolved_per_page,
        "pages": pages,
    }


@router.get("/{call_id}", response_model=CallDetailResponse)
def get_call(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    del current_user
    try:
        call_uuid = UUID(str(call_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Call not found") from exc

    result = (
        db.query(Call, Client)
        .outerjoin(Client, Client.id == Call.client_id)
        .filter(Call.id == call_uuid)
        .first()
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Call not found")

    call, client = result
    return _build_call_detail(call, client)


@router.get("/{call_id}/events", response_model=list[CallEventResponse])
def get_call_events(
    call_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    del current_user
    try:
        call_uuid = UUID(str(call_id))
    except ValueError as exc:
        raise HTTPException(status_code=404, detail="Call not found") from exc

    result = (
        db.query(Call, Client)
        .outerjoin(Client, Client.id == Call.client_id)
        .filter(Call.id == call_uuid)
        .first()
    )
    if result is None:
        raise HTTPException(status_code=404, detail="Call not found")

    call, client = result
    return _build_call_events(call, client)
