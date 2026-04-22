from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.call import Call, CallStatus, Reschedule
from app.models.client import Client, ClientStatus
from app.services.calling_window import align_to_calling_window, next_call_window_start
from app.services.webhook_verifier import verify_vapi_request


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


def _extract_event_type(payload: dict) -> str | None:
    message = payload.get("message") or {}
    return message.get("type") or payload.get("type")


def _extract_call_block(payload: dict) -> dict:
    message = payload.get("message") or {}
    return message.get("call") or payload.get("call") or {}


def _extract_vapi_call_id(payload: dict) -> str | None:
    return _extract_call_block(payload).get("id")


def _extract_customer_number(payload: dict) -> str | None:
    call_block = _extract_call_block(payload)
    customer = call_block.get("customer") or payload.get("customer") or {}
    return customer.get("number")


def _map_ended_reason_to_status(reason: str | None) -> CallStatus:
    normalized = (reason or "").strip().lower()
    reason_map = {
        "assistant-ended-call": CallStatus.COMPLETED,
        "customer-ended-call": CallStatus.COMPLETED,
        "customer-did-not-answer": CallStatus.NO_ANSWER,
        "customer-busy": CallStatus.BUSY,
        "voicemail": CallStatus.VOICEMAIL,
        "silence-timed-out": CallStatus.NO_ANSWER,
        "pipeline-error": CallStatus.FAILED,
        "max-duration-exceeded": CallStatus.COMPLETED,
    }
    return reason_map.get(normalized, CallStatus.COMPLETED)


def _update_client_status_from_call(client: Client, call: Call) -> None:
    if call.status == CallStatus.COMPLETED:
        client.status = ClientStatus.COMPLETED
    elif call.status == CallStatus.REFUSED:
        client.status = ClientStatus.REFUSED
    elif call.status in {
        CallStatus.NO_ANSWER,
        CallStatus.VOICEMAIL,
        CallStatus.BUSY,
        CallStatus.FAILED,
    }:
        client.status = ClientStatus.FAILED
    else:
        client.status = ClientStatus.IN_PROGRESS


def _get_retry_target_time(client: Client, call: Call, reference_time: datetime) -> datetime | None:
    if call.attempt_number >= settings.max_call_retries:
        return None

    if call.attempt_number == 1:
        retry_time = reference_time + timedelta(minutes=settings.retry_delay_1_minutes)
    elif call.attempt_number == 2:
        retry_time = reference_time + timedelta(minutes=settings.retry_delay_2_minutes)
    else:
        retry_time = reference_time + timedelta(hours=settings.retry_delay_3_hours)

    return align_to_calling_window(retry_time, client.timezone)


def _schedule_retry(client: Client, call: Call, reference_time: datetime) -> None:
    retry_time = _get_retry_target_time(client, call, reference_time)
    if retry_time is None:
        client.status = ClientStatus.MANUAL_FOLLOW_UP_REQUIRED
        return

    client.scheduled_call_time = retry_time
    client.status = ClientStatus.PENDING


def _parse_reschedule_time(raw_value: str | None, timezone_name: str) -> datetime | None:
    if not raw_value:
        return None

    try:
        parsed = datetime.fromisoformat(raw_value)
    except ValueError:
        return None

    client_tz = ZoneInfo(timezone_name)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=client_tz)

    return align_to_calling_window(parsed.astimezone(timezone.utc), timezone_name)


def _handle_reschedule(
    db: Session,
    client: Client,
    call: Call,
    function_call_payload: dict,
) -> None:
    if client.reschedule_count >= 3:
        client.status = ClientStatus.MANUAL_FOLLOW_UP_REQUIRED
        return

    parameters = function_call_payload.get("parameters") or {}
    requested_time = _parse_reschedule_time(
        parameters.get("new_datetime") or parameters.get("scheduled_call_time"),
        client.timezone,
    )
    if requested_time is None:
        requested_time = next_call_window_start(client.timezone)

    original_time = client.scheduled_call_time or datetime.now(timezone.utc)

    reschedule = Reschedule(
        client_id=client.id,
        call_id=call.id,
        original_time=original_time,
        new_time=requested_time,
        reason=parameters.get("reason") or parameters.get("notes"),
    )
    db.add(reschedule)

    client.scheduled_call_time = requested_time
    client.reschedule_count += 1
    client.status = ClientStatus.RESCHEDULED


def _find_or_create_call(db: Session, payload: dict) -> Call | None:
    vapi_call_id = _extract_vapi_call_id(payload)
    if vapi_call_id:
        existing_call = db.query(Call).filter(Call.vapi_call_id == vapi_call_id).first()
        if existing_call:
            return existing_call

    call_block = _extract_call_block(payload)
    metadata = call_block.get("metadata") or payload.get("metadata") or {}
    raw_client_id = metadata.get("client_id") or metadata.get("internal_client_id")
    client: Client | None = None

    if raw_client_id:
        try:
            client = db.query(Client).filter(Client.id == UUID(str(raw_client_id))).first()
        except ValueError:
            client = None

    if client is None:
        customer_number = _extract_customer_number(payload)
        if customer_number:
            client = db.query(Client).filter(Client.phone_number == customer_number).first()

    if client is None:
        return None

    attempt_number = (
        db.query(Call)
        .filter(Call.client_id == client.id)
        .count()
    ) + 1

    call = Call(
        client_id=client.id,
        vapi_call_id=vapi_call_id,
        attempt_number=attempt_number,
        status=CallStatus.INITIATED,
    )
    db.add(call)
    db.flush()
    return call


@router.post("/vapi")
async def receive_vapi_webhook(request: Request):
    body = await request.body()
    if not verify_vapi_request(request, body):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Vapi webhook authentication",
        )

    payload = await request.json()
    event_type = _extract_event_type(payload)
    vapi_call_id = _extract_vapi_call_id(payload)
    call_block = _extract_call_block(payload)

    db = SessionLocal()
    try:
        call = _find_or_create_call(db, payload)
        if call is None:
            return {"received": True, "ignored": "call not matched"}

        if vapi_call_id and not call.vapi_call_id:
            call.vapi_call_id = vapi_call_id

        client = db.query(Client).filter(Client.id == call.client_id).first()

        if event_type == "call-started":
            call.status = CallStatus.IN_PROGRESS
            call.started_at = datetime.now(timezone.utc)
            if client is not None:
                client.status = ClientStatus.IN_PROGRESS
                client.last_call_attempt_at = call.started_at

        elif event_type == "call-ended":
            ended_at = datetime.now(timezone.utc)
            call.ended_at = ended_at
            if call.started_at is None:
                call.started_at = ended_at

            ended_reason = (
                (payload.get("message") or {}).get("endedReason")
                or payload.get("endedReason")
                or call_block.get("endedReason")
            )
            call.status = _map_ended_reason_to_status(ended_reason)

            transcript_messages = call_block.get("messages")
            if transcript_messages and not call.transcript:
                call.transcript = "\n".join(
                    str(message.get("message", "")).strip()
                    for message in transcript_messages
                    if message.get("message")
                ) or None

            recording_url = call_block.get("recordingUrl") or payload.get("recordingUrl")
            if recording_url:
                call.recording_url = recording_url

            if call.started_at and call.ended_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())

            if client is not None:
                client.last_call_attempt_at = ended_at
                _update_client_status_from_call(client, call)
                if call.status in {
                    CallStatus.NO_ANSWER,
                    CallStatus.VOICEMAIL,
                    CallStatus.BUSY,
                    CallStatus.FAILED,
                }:
                    _schedule_retry(client, call, ended_at)

        elif event_type == "status-update":
            status_value = (payload.get("message") or {}).get("status") or call_block.get("status")
            if status_value == "in-progress":
                call.status = CallStatus.IN_PROGRESS

        elif event_type == "function-call":
            function_call_payload = ((payload.get("message") or {}).get("functionCall") or {})
            function_name = function_call_payload.get("name")
            if function_name == "mark_refused":
                call.status = CallStatus.REFUSED
                if client is not None:
                    client.status = ClientStatus.REFUSED
            elif function_name == "book_reschedule" and client is not None:
                _handle_reschedule(db, client, call, function_call_payload)

        db.commit()
    finally:
        db.close()

    return {"received": True}
