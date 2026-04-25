from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.call import Call, CallStatus
from app.models.client import Client, ClientStatus
from app.services.calling_window import (
    align_to_calling_window,
    get_effective_calling_window,
)
from app.services.notifier import notifier
from app.services.reschedule_service import book_reschedule, check_slot_availability
from app.services.webhook_verifier import verify_vapi_request


router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = logging.getLogger(__name__)

# Force print for docker logs visibility
def debug_log(msg: str):
    print(f"[VAPI-DEBUG] {msg}", flush=True)
    logger.info(msg)


def _extract_event_type(payload: dict) -> str | None:
    event_type = payload.get("type")
    if event_type:
        return str(event_type)
    message = payload.get("message") or {}
    return message.get("type")


def _extract_call_block(payload: dict) -> dict:
    call = payload.get("call")
    if isinstance(call, dict):
        return call
    message = payload.get("message") or {}
    call = message.get("call")
    if isinstance(call, dict):
        return call
    return {}


def _extract_vapi_call_id(payload: dict) -> str | None:
    return _extract_call_block(payload).get("id")


def _extract_customer_number(payload: dict) -> str | None:
    call_block = _extract_call_block(payload)
    customer = call_block.get("customer")
    if isinstance(customer, dict) and customer.get("number"):
        return str(customer.get("number"))
    
    # Try top-level or message-level customer
    customer = payload.get("customer") or (payload.get("message") or {}).get("customer")
    if isinstance(customer, dict) and customer.get("number"):
        return str(customer.get("number"))

    return None


def _extract_tool_call_list(payload: dict) -> list[dict]:
    # Check for direct object
    tc = payload.get("toolCall")
    if isinstance(tc, dict):
        return [tc]

    for key in ("toolCallList", "toolCalls", "tool_calls"):
        tool_calls = payload.get(key)
        if isinstance(tool_calls, list):
            return tool_calls
    
    # Check message level
    message = payload.get("message") or {}
    tc = message.get("toolCall")
    if isinstance(tc, dict):
        return [tc]

    for key in ("toolCallList", "toolCalls", "tool_calls"):
        tool_calls = message.get(key)
        if isinstance(tool_calls, list):
            return tool_calls
    
    return []


def _extract_tool_arguments(tool_call: dict) -> dict:
    # 1. Check top-level 'arguments'
    args = tool_call.get("arguments")
    if isinstance(args, dict):
        return args
    if isinstance(args, str) and args.strip():
        try:
            return json.loads(args)
        except json.JSONDecodeError:
            pass

    # 2. Check 'function' block
    fn = tool_call.get("function") or {}
    
    # 2a. Check 'function.arguments' (standard OpenAI format, often a string)
    args = fn.get("arguments")
    if isinstance(args, dict):
        return args
    if isinstance(args, str) and args.strip():
        try:
            return json.loads(args)
        except json.JSONDecodeError:
            pass

    # 2b. Check 'function.parameters' (some Vapi formats)
    params = fn.get("parameters")
    if isinstance(params, dict):
        return params
    if isinstance(params, str) and params.strip():
        try:
            return json.loads(params)
        except json.JSONDecodeError:
            pass

    return {}


def _build_tool_result(tool_call_id: str, *, result: Any = None, error: str | None = None) -> dict:
    payload: dict[str, Any] = {"toolCallId": tool_call_id}
    if error is not None:
        payload["error"] = " ".join(error.split())
    else:
        payload["result"] = result or {}
    return payload


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
    call_status_str = str(call.status.value) if hasattr(call.status, "value") else str(call.status)
    
    if "rescheduled" in call_status_str.lower():
        client.status = ClientStatus.RESCHEDULED
    elif "completed" in call_status_str.lower():
        client.status = ClientStatus.COMPLETED
    elif "refused" in call_status_str.lower():
        client.status = ClientStatus.REFUSED
    elif any(s in call_status_str.lower() for s in ["no_answer", "voicemail", "busy", "failed"]):
        client.status = ClientStatus.FAILED
    else:
        client.status = ClientStatus.IN_PROGRESS


def _get_retry_target_time(client: Client, call: Call, reference_time: datetime, call_window) -> datetime | None:
    if call.attempt_number >= settings.max_call_retries:
        return None

    if call.attempt_number == 1:
        retry_time = reference_time + timedelta(minutes=settings.retry_delay_1_minutes)
    elif call.attempt_number == 2:
        retry_time = reference_time + timedelta(minutes=settings.retry_delay_2_minutes)
    else:
        retry_time = reference_time + timedelta(hours=settings.retry_delay_3_hours)

    return align_to_calling_window(
        retry_time,
        client.timezone,
        call_window=call_window,
    )


def _schedule_retry(client: Client, call: Call, reference_time: datetime, call_window) -> None:
    retry_time = _get_retry_target_time(client, call, reference_time, call_window)
    if retry_time is None:
        client.status = ClientStatus.MANUAL_FOLLOW_UP_REQUIRED
        return

    client.scheduled_call_time = retry_time
    client.status = ClientStatus.PENDING


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


def _get_client_for_call(db: Session, call: Call | None) -> Client | None:
    if call is None:
        return None
    return db.query(Client).filter(Client.id == call.client_id).first()


@router.post("/vapi/tools")
async def receive_vapi_tool_calls(request: Request):
    body = await request.body()
    if not verify_vapi_request(request, body):
        logger.warning("Vapi tool request rejected: invalid authentication")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Vapi webhook authentication",
        )

    payload = await request.json()
    event_type = _extract_event_type(payload)
    tool_call_list = _extract_tool_call_list(payload)
    
    debug_log(f"Received tool-calls. event_type={event_type}, count={len(tool_call_list)}")
    if tool_call_list:
        for idx, tc in enumerate(tool_call_list):
            debug_log(f"  Tool[{idx}]: id={tc.get('id')}, name={tc.get('name')}, func_name={ (tc.get('function') or {}).get('name') }")

    if not tool_call_list:
        debug_log("No tool calls found in payload.")
        return {"results": []}

    db = SessionLocal()
    try:
        call = _find_or_create_call(db, payload)
        client = _get_client_for_call(db, call)
        debug_log(f"Identification: call_found={call is not None}, client_found={client is not None}")
        call_window = get_effective_calling_window(db)
        results: list[dict] = []
        should_commit = False
        should_notify = False

        for tool_call in tool_call_list:
            tool_call_id = str(tool_call.get("id") or "")
            debug_log(f"  Raw Tool Call: {json.dumps(tool_call, default=str)}")
            tool_name_raw = tool_call.get("name")
            if not tool_name_raw:
                function_block = tool_call.get("function") or {}
                tool_name_raw = function_block.get("name")
            
            tool_name = str(tool_name_raw or "").strip().lower().replace(" ", "_").replace("-", "_")
            arguments = _extract_tool_arguments(tool_call)
            debug_log(f"  Arguments: {json.dumps(arguments, default=str)}")

            if not tool_call_id:
                continue

            if tool_name == "check_available_slots":
                timezone_name = arguments.get("lead_timezone") or (client.timezone if client is not None else "UTC")
                requested_time = (
                    arguments.get("lead_requested_callback_time")
                    or arguments.get("requested_callback_time")
                    or arguments.get("confirmed_datetime")
                )
                slot_check = check_slot_availability(
                    lead_timezone=timezone_name,
                    requested_callback_time=requested_time,
                    call_window=call_window,
                )
                results.append(
                    _build_tool_result(
                        tool_call_id,
                        result={
                            "available": slot_check.is_available,
                            "reason": slot_check.reason,
                            "lead_timezone": slot_check.lead_timezone,
                            "requested_local_iso": slot_check.requested_local_iso,
                            "requested_utc_iso": slot_check.requested_utc_iso,
                            "window_start_local": call_window.start_text,
                            "window_end_local": call_window.end_text,
                        },
                    )
                )
                continue

            if tool_name in ("book_reschedule", "book_callback", "confirm_reschedule"):
                if client is None:
                    results.append(
                        _build_tool_result(
                            tool_call_id,
                            error="Unable to identify the lead for this call.",
                        )
                    )
                    continue

                booking = book_reschedule(
                    db,
                    client=client,
                    call=call,
                    confirmed_datetime=(
                        arguments.get("confirmed_datetime")
                        or arguments.get("confirmed_callback_time")
                        or arguments.get("scheduled_call_time")
                        or arguments.get("lead_requested_callback_time")
                        or arguments.get("requested_callback_time")
                    ),
                    reason=arguments.get("reason") or arguments.get("notes"),
                    lead_timezone=arguments.get("lead_timezone") or client.timezone,
                    call_window=call_window,
                )
                if booking.success:
                    should_commit = True
                    should_notify = True
                    if call is not None:
                        call.status = CallStatus.RESCHEDULED
                    results.append(
                        _build_tool_result(
                            tool_call_id,
                            result={
                                "success": True,
                                "reason": booking.reason,
                                "lead_timezone": booking.lead_timezone,
                                "scheduled_local_iso": booking.scheduled_local_iso,
                                "scheduled_utc_iso": booking.scheduled_utc_iso,
                                "reschedule_count": booking.reschedule_count,
                            },
                        )
                    )
                else:
                    if booking.reason == "max_reschedules_reached":
                        should_commit = True
                        should_notify = True
                    results.append(
                        _build_tool_result(
                            tool_call_id,
                            result={
                                "success": False,
                                "reason": booking.reason,
                                "lead_timezone": booking.lead_timezone,
                                "scheduled_local_iso": booking.scheduled_local_iso,
                                "scheduled_utc_iso": booking.scheduled_utc_iso,
                                "reschedule_count": booking.reschedule_count,
                            },
                        )
                    )
                continue

            results.append(
                _build_tool_result(
                    tool_call_id,
                    error=f"Unsupported tool: {tool_name or 'unknown'}",
                )
            )

        if should_commit:
            db.commit()

        if should_notify and client is not None:
            await notifier.publish({
                "type": "status_update",
                "client_id": str(client.id),
                "call_id": str(call.id) if call is not None else None,
                "event_type": "tool-calls",
                "client_status": str(client.status.value) if hasattr(client.status, "value") else str(client.status),
                "call_status": str(call.status.value) if call is not None and hasattr(call.status, "value") else (
                    str(call.status) if call is not None else None
                ),
            })

        debug_log(f"Returning tool results: {json.dumps(results, default=str)}")
        return {"results": results}
    finally:
        db.close()


@router.post("/vapi")
async def receive_vapi_webhook(request: Request):
    body = await request.body()
    if not verify_vapi_request(request, body):
        logger.warning("Vapi webhook rejected: invalid authentication")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Vapi webhook authentication",
        )

    payload = await request.json()
    event_type = _extract_event_type(payload)
    vapi_call_id = _extract_vapi_call_id(payload)
    call_block = _extract_call_block(payload)
    message_block = payload.get("message") or {}
    customer_number = _extract_customer_number(payload)

    print(
        f"[VAPI WEBHOOK] received event_type={event_type} vapi_call_id={vapi_call_id} customer_number={customer_number}",
        flush=True,
    )
    logger.info(
        "Vapi webhook received: event_type=%s vapi_call_id=%s customer_number=%s",
        event_type,
        vapi_call_id,
        customer_number,
    )
    logger.debug("Full payload: %s", json.dumps(payload, default=str))

    db = SessionLocal()
    try:
        call = _find_or_create_call(db, payload)
        if call is None:
            response_payload = {
                "received": True,
                "event_type": event_type,
                "vapi_call_id": vapi_call_id,
                "ignored": "call not matched",
            }
            logger.warning(
                "Vapi webhook ignored because no matching call/client was found: "
                "event_type=%s vapi_call_id=%s customer_number=%s",
                event_type,
                vapi_call_id,
                customer_number,
            )
            print(f"[VAPI WEBHOOK] response={json.dumps(response_payload, default=str)}", flush=True)
            return response_payload

        if vapi_call_id and not call.vapi_call_id:
            call.vapi_call_id = vapi_call_id

        client = db.query(Client).filter(Client.id == call.client_id).first()
        call_window = get_effective_calling_window(db)

        logger.info(
            "Processing Vapi webhook: event_type=%s call_id=%s client_id=%s current_call_status=%s "
            "current_client_status=%s",
            event_type,
            call.id,
            call.client_id,
            call.status,
            client.status if client is not None else None,
        )

        if event_type in {"call-started", "assistant.started"}:
            call.status = CallStatus.IN_PROGRESS
            if not call.started_at:
                call.started_at = datetime.now(timezone.utc)
            if client is not None:
                client.status = ClientStatus.IN_PROGRESS
                client.last_call_attempt_at = call.started_at

        elif event_type in {"call-ended", "end-of-call-report"}:
            ended_at = datetime.now(timezone.utc)
            if not call.ended_at:
                call.ended_at = ended_at
            if call.started_at is None:
                call.started_at = ended_at

            ended_reason = (
                (payload.get("message") or {}).get("endedReason")
                or payload.get("endedReason")
                or call_block.get("endedReason")
            )
            current_status_str = str(call.status.value) if hasattr(call.status, "value") else str(call.status)
            terminal_statuses = {"completed", "failed", "no_answer", "busy", "voicemail", "rescheduled", "refused"}
            is_terminal = any(s in current_status_str.lower() for s in terminal_statuses)
            
            if not is_terminal:
                call.status = _map_ended_reason_to_status(ended_reason)

            transcript_messages = (
                call_block.get("messages") 
                or (call_block.get("artifact") or {}).get("messages")
                or message_block.get("artifact", {}).get("messages")
            )
            
            if transcript_messages:
                formatted_lines = []
                for msg in transcript_messages:
                    role = msg.get("role")
                    content = msg.get("message") or msg.get("content")
                    
                    # Skip system messages (the long prompt instructions)
                    if role == "system" or not content:
                        continue
                        
                    label = "Assistant" if role == "assistant" else "User" if role == "user" else role.capitalize()
                    formatted_lines.append(f"{label}: {str(content).strip()}")
                
                if formatted_lines:
                    call.transcript = "\n".join(formatted_lines)

            if not call.transcript:
                # Fallback to plain transcript artifact if available
                call.transcript = (
                    (call_block.get("artifact") or {}).get("transcript")
                    or message_block.get("artifact", {}).get("transcript")
                )

            recording_url = call_block.get("recordingUrl") or payload.get("recordingUrl")
            if recording_url:
                call.recording_url = recording_url

            if call.started_at and call.ended_at:
                call.duration_seconds = int((call.ended_at - call.started_at).total_seconds())

            # Extract analysis data (summary, structured data, sentiment)
            analysis = (
                call_block.get("analysis") 
                or payload.get("analysis") 
                or message_block.get("analysis")
                or {}
            )
            
            # 1. Try standard summary
            call.summary = analysis.get("summary")
            
            # 2. Try structured data
            structured_data = analysis.get("structuredData")
            if structured_data:
                call.structured_answers = structured_data
                
                # If standard summary is missing, look for "Call Summary" in structured data
                if not call.summary:
                    if isinstance(structured_data, dict):
                        # Handle the ID-based map format the user provided
                        for item in structured_data.values():
                            if isinstance(item, dict) and item.get("name") == "Call Summary":
                                call.summary = item.get("result")
                                break
                    elif isinstance(structured_data, list):
                        # Handle list format just in case
                        for item in structured_data:
                            if isinstance(item, dict) and item.get("name") == "Call Summary":
                                call.summary = item.get("result")
                                break
                
            raw_sentiment = analysis.get("sentiment")
            if raw_sentiment:
                try:
                    from app.models.call import SentimentType
                    call.sentiment = SentimentType(raw_sentiment.lower())
                except (ValueError, ImportError):
                    logger.warning("Unknown sentiment value received: %s", raw_sentiment)

            if client is not None:
                client.last_call_attempt_at = ended_at
                _update_client_status_from_call(client, call)
                if call.status in {
                    CallStatus.NO_ANSWER,
                    CallStatus.VOICEMAIL,
                    CallStatus.BUSY,
                    CallStatus.FAILED,
                }:
                    _schedule_retry(client, call, ended_at, call_window)

        elif event_type == "status-update":
            status_value = (payload.get("message") or {}).get("status") or call_block.get("status")
            logger.info(
                "Vapi status-update received: vapi_call_id=%s status_value=%s",
                vapi_call_id,
                status_value,
            )
            if status_value == "in-progress":
                call.status = CallStatus.IN_PROGRESS
                if client is not None:
                    client.status = ClientStatus.IN_PROGRESS
            elif status_value == "ended":
                # Only update to COMPLETED if not already in a terminal/special state
                current_status_str = str(call.status.value) if hasattr(call.status, "value") else str(call.status)
                terminal_statuses = {"completed", "failed", "no_answer", "busy", "voicemail", "rescheduled", "refused"}
                
                is_terminal = any(s in current_status_str.lower() for s in terminal_statuses)
                if not is_terminal:
                    call.status = CallStatus.COMPLETED

        elif event_type == "function-call":
            function_call_payload = ((payload.get("message") or {}).get("functionCall") or {})
            function_name = function_call_payload.get("name")
            logger.info(
                "Vapi function-call received: vapi_call_id=%s function_name=%s parameters=%s",
                vapi_call_id,
                function_name,
                json.dumps(function_call_payload.get("parameters") or {}, default=str)[:2000],
            )
            if function_name == "mark_refused":
                call.status = CallStatus.REFUSED
                if client is not None:
                    client.status = ClientStatus.REFUSED
            elif function_name == "book_reschedule" and client is not None:
                parameters = function_call_payload.get("parameters") or {}
                booking = book_reschedule(
                    db,
                    client=client,
                    call=call,
                    confirmed_datetime=(
                        parameters.get("confirmed_datetime")
                        or parameters.get("new_datetime")
                        or parameters.get("scheduled_call_time")
                    ),
                    reason=parameters.get("reason") or parameters.get("notes"),
                    lead_timezone=parameters.get("lead_timezone") or client.timezone,
                    call_window=call_window,
                )
                if booking.success:
                    call.status = CallStatus.RESCHEDULED
                else:
                    logger.warning(
                        "book_reschedule function-call rejected: client_id=%s reason=%s confirmed_datetime=%s",
                        client.id,
                        booking.reason,
                        parameters.get("confirmed_datetime") or parameters.get("new_datetime") or parameters.get("scheduled_call_time"),
                    )

        db.commit()
        await notifier.publish({
            "type": "status_update",
            "client_id": str(client.id) if client else None,
            "call_id": str(call.id) if call else None,
            "event_type": event_type,
            "client_status": str(client.status.value) if client and hasattr(client.status, "value") else str(client.status if client else None),
            "call_status": str(call.status.value) if call and hasattr(call.status, "value") else str(call.status if call else None),
        })
        logger.info(
            "Vapi webhook processed: event_type=%s call_id=%s final_call_status=%s final_client_status=%s",
            event_type,
            call.id,
            call.status,
            client.status if client is not None else None,
        )
        response_payload = {
            "received": True,
            "event_type": event_type,
            "vapi_call_id": vapi_call_id,
            "call_id": str(call.id),
            "call_status": call.status.value if hasattr(call.status, "value") else str(call.status),
            "client_status": client.status.value if client is not None and hasattr(client.status, "value") else (
                str(client.status) if client is not None else None
            ),
        }
    finally:
        db.close()

    print(f"[VAPI WEBHOOK] response={json.dumps(response_payload, default=str)}", flush=True)
    return response_payload
