from __future__ import annotations

from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database.dependencies import get_db
from app.models.call import Call, CallStatus, Reschedule
from app.models.client import Client, ClientStatus
from app.models.user import User
from app.routes.auth import get_authenticated_user
from app.schemas.dashboard import (
    DashboardActivityItem,
    DashboardOverviewResponse,
    DashboardStats,
    DashboardVolumePoint,
)


router = APIRouter(prefix="/dashboard", tags=["dashboard"])


FAILED_CALL_STATUSES = {
    CallStatus.FAILED,
    CallStatus.NO_ANSWER,
    CallStatus.VOICEMAIL,
    CallStatus.BUSY,
}


@router.get("/overview", response_model=DashboardOverviewResponse)
def get_dashboard_overview(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user),
):
    del current_user

    now_utc = datetime.now(timezone.utc)
    start_of_today = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    start_of_window = start_of_today - timedelta(days=6)

    recent_calls = (
        db.query(Call)
        .order_by(Call.ended_at.desc().nullslast(), Call.created_at.desc())
        .limit(100)
        .all()
    )

    all_clients = db.query(Client).all()
    recent_reschedules = (
        db.query(Reschedule)
        .filter(Reschedule.created_at >= start_of_window)
        .all()
    )

    client_map = {str(client.id): client for client in all_clients}

    calls_today = [
        call for call in recent_calls
        if (call.created_at or now_utc) >= start_of_today
    ]

    successful_calls = [call for call in calls_today if call.status in {CallStatus.COMPLETED, CallStatus.RESCHEDULED}]
    failed_calls = [call for call in calls_today if call.status in FAILED_CALL_STATUSES]
    rescheduled_calls_today = [call for call in calls_today if call.status == CallStatus.RESCHEDULED]

    duration_values = [
        call.duration_seconds for call in recent_calls
        if call.duration_seconds is not None and call.duration_seconds > 0
    ]
    avg_duration_seconds = int(sum(duration_values) / len(duration_values)) if duration_values else 0

    ended_calls = [
        call for call in recent_calls
        if call.status in FAILED_CALL_STATUSES or call.status in {CallStatus.COMPLETED, CallStatus.RESCHEDULED}
    ]
    success_rate = int(
        round((len([call for call in ended_calls if call.status in {CallStatus.COMPLETED, CallStatus.RESCHEDULED}]) / len(ended_calls)) * 100)
    ) if ended_calls else 0

    volume_map: dict[str, dict[str, int]] = {}
    for day_offset in range(7):
        day = start_of_window + timedelta(days=day_offset)
        label = day.strftime("%b %d")
        volume_map[label] = {
            "date": label,
            "completed": 0,
            "failed": 0,
            "rescheduled": 0,
        }

    for call in recent_calls:
        event_time = call.ended_at or call.created_at
        if event_time is None or event_time < start_of_window:
            continue
        label = event_time.astimezone(timezone.utc).strftime("%b %d")
        if label not in volume_map:
            continue
        if call.status == CallStatus.COMPLETED:
            volume_map[label]["completed"] += 1
        elif call.status == CallStatus.RESCHEDULED:
            # We already count reschedules from Reschedule model below, 
            # but if we want to be safe we could ensure no double counting.
            # Actually, let's keep the existing logic for volume_map["rescheduled"] 
            # as it uses the Reschedule model which is more accurate for historical data.
            pass
        elif call.status in FAILED_CALL_STATUSES:
            volume_map[label]["failed"] += 1

    for reschedule in recent_reschedules:
        if reschedule.created_at is None:
            continue
        label = reschedule.created_at.astimezone(timezone.utc).strftime("%b %d")
        if label in volume_map:
            volume_map[label]["rescheduled"] += 1

    activity_items: list[DashboardActivityItem] = []
    for call in recent_calls[:5]:
        client = client_map.get(str(call.client_id))
        activity_items.append(
            DashboardActivityItem(
                call_id=str(call.id),
                client_name=client.full_name if client else "Unknown Client",
                phone_number=client.phone_number if client else "",
                status=call.status.value,
                sentiment=call.sentiment.value if call.sentiment else None,
                ended_at=call.ended_at or call.created_at or now_utc,
                duration_seconds=call.duration_seconds or 0,
            )
        )

    stats = DashboardStats(
        calls_today=len(calls_today),
        calls_successful=len(successful_calls),
        calls_failed=len(failed_calls),
        calls_rescheduled=len(rescheduled_calls_today),
        calls_pending=len([client for client in all_clients if client.status in {ClientStatus.PENDING, ClientStatus.QUEUED}]),
        success_rate=success_rate,
        avg_duration_seconds=avg_duration_seconds,
    )

    call_volume = [DashboardVolumePoint(**volume_map[key]) for key in volume_map]

    return DashboardOverviewResponse(
        stats=stats,
        call_volume=call_volume,
        recent_activity=activity_items,
    )
