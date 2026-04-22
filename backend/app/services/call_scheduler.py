from __future__ import annotations

import asyncio
import logging
from contextlib import suppress
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import func

from app.core.config import settings
from app.database.session import SessionLocal
from app.models.call import Call, CallStatus
from app.models.client import Client, ClientStatus
from app.services.calling_window import (
    get_effective_calling_window,
    is_within_calling_window,
    next_call_window_start,
)
from app.services.vapi_client import VapiConfigurationError, start_outbound_call


logger = logging.getLogger(__name__)


ACTIVE_CALL_STATUSES = (
    CallStatus.INITIATED,
    CallStatus.IN_PROGRESS,
)

CALLABLE_CLIENT_STATUSES = (
    ClientStatus.PENDING,
    ClientStatus.RESCHEDULED,
)


def _get_active_call_count() -> int:
    db = SessionLocal()
    try:
        return (
            db.query(func.count(Call.id))
            .filter(Call.status.in_(ACTIVE_CALL_STATUSES))
            .scalar()
            or 0
        )
    finally:
        db.close()


def _get_due_client_ids(limit: int) -> list[str]:
    now_utc = datetime.now(timezone.utc)
    db = SessionLocal()
    try:
        clients = (
            db.query(Client)
            .filter(
                Client.is_active.is_(True),
                Client.status.in_(CALLABLE_CLIENT_STATUSES),
                Client.scheduled_call_time.is_not(None),
                Client.scheduled_call_time <= now_utc,
            )
            .order_by(Client.scheduled_call_time.asc(), Client.created_at.asc())
            .limit(limit * 3 if limit > 0 else 0)
            .all()
        )
        call_window = get_effective_calling_window(db)

        selected_client_ids: list[str] = []
        for client in clients:
            if is_within_calling_window(
                client.timezone,
                reference_time=now_utc,
                call_window=call_window,
            ):
                selected_client_ids.append(str(client.id))
                if len(selected_client_ids) >= limit:
                    break
            else:
                client.scheduled_call_time = next_call_window_start(
                    client.timezone,
                    reference_time=now_utc,
                    call_window=call_window,
                )
                db.add(client)

        db.commit()
        return selected_client_ids
    finally:
        db.close()


async def trigger_client_call(client_id: str) -> bool:
    db = SessionLocal()
    call: Call | None = None
    client: Client | None = None
    now_utc = datetime.now(timezone.utc)

    try:
        client_uuid = UUID(str(client_id))
        client = db.query(Client).filter(Client.id == client_uuid).first()
        call_window = get_effective_calling_window(db)

        if client is None:
            return False

        if not client.is_active:
            return False

        if client.status not in CALLABLE_CLIENT_STATUSES and client.status != ClientStatus.QUEUED:
            return False

        client_scheduled_time = client.scheduled_call_time
        if client_scheduled_time is not None and client_scheduled_time.tzinfo is None:
            client_scheduled_time = client_scheduled_time.replace(tzinfo=timezone.utc)

        if client_scheduled_time is None or client_scheduled_time > now_utc:
            return False

        if not is_within_calling_window(
            client.timezone,
            reference_time=now_utc,
            call_window=call_window,
        ):
            client.scheduled_call_time = next_call_window_start(
                client.timezone,
                reference_time=now_utc,
                call_window=call_window,
            )
            db.commit()
            return False

        active_existing_call = (
            db.query(Call)
            .filter(
                Call.client_id == client.id,
                Call.status.in_(ACTIVE_CALL_STATUSES),
            )
            .first()
        )
        if active_existing_call is not None:
            client.status = ClientStatus.QUEUED
            db.commit()
            return False

        attempt_number = (
            db.query(func.count(Call.id))
            .filter(Call.client_id == client.id)
            .scalar()
            or 0
        ) + 1

        client.status = ClientStatus.QUEUED
        client.last_call_attempt_at = now_utc

        call = Call(
            client_id=client.id,
            attempt_number=attempt_number,
            status=CallStatus.INITIATED,
            started_at=now_utc,
        )
        db.add(call)
        db.flush()
        db.commit()
        db.refresh(call)
        db.refresh(client)

        try:
            response = await start_outbound_call(client)
        except VapiConfigurationError:
            raise
        except Exception as exc:
            db.rollback()
            call = db.query(Call).filter(Call.id == call.id).first()
            client = db.query(Client).filter(Client.id == client.id).first()
            if call is not None:
                call.status = CallStatus.FAILED
                call.error_message = str(exc)
            if client is not None:
                client.status = ClientStatus.FAILED
            db.commit()
            logger.exception("Failed to trigger Vapi call for client %s", client_id)
            return False

        call = db.query(Call).filter(Call.id == call.id).first()
        client = db.query(Client).filter(Client.id == client.id).first()
        if call is not None:
            call.vapi_call_id = response.get("id")
            call.error_message = None
        if client is not None:
            client.status = ClientStatus.QUEUED
        db.commit()
        return True

    except VapiConfigurationError:
        if call is not None:
            call = db.query(Call).filter(Call.id == call.id).first()
            if call is not None:
                call.status = CallStatus.FAILED
                call.error_message = "Missing Vapi configuration"
        if client is not None:
            client = db.query(Client).filter(Client.id == client.id).first()
            if client is not None:
                client.status = ClientStatus.FAILED
        db.commit()
        logger.warning("Scheduler skipped Vapi call because configuration is incomplete.")
        return False
    finally:
        db.close()


async def scheduler_tick() -> int:
    active_calls = _get_active_call_count()
    available_slots = max(settings.max_concurrent_calls - active_calls, 0)
    
    logger.info("Scheduler tick: %s active calls, %s slots available", active_calls, available_slots)
    
    if available_slots <= 0:
        return 0

    client_ids = _get_due_client_ids(available_slots)
    if not client_ids:
        logger.debug("No leads are currently due for calling.")
        return 0
    
    logger.info("Found %s leads due for calling: %s", len(client_ids), client_ids)

    results = await asyncio.gather(
        *(trigger_client_call(client_id) for client_id in client_ids),
        return_exceptions=True,
    )

    triggered = 0
    for client_id, result in zip(client_ids, results):
        if isinstance(result, Exception):
            logger.exception("Unhandled scheduler trigger error for client %s", client_id, exc_info=result)
            continue
        if result:
            triggered += 1

    return triggered


async def run_scheduler_loop() -> None:
    logger.info(
        "Auto-call scheduler started. Tick every %s seconds.",
        settings.scheduler_tick_seconds,
    )
    while True:
        try:
            await scheduler_tick()
        except asyncio.CancelledError:
            raise
        except Exception:
            logger.exception("Unhandled scheduler loop error")

        await asyncio.sleep(settings.scheduler_tick_seconds)


async def shutdown_scheduler(task: asyncio.Task | None) -> None:
    if task is None:
        return
    task.cancel()
    with suppress(asyncio.CancelledError):
        await task
