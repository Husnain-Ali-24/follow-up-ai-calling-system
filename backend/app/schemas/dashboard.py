from datetime import datetime
from pydantic import BaseModel


class DashboardStats(BaseModel):
    calls_today: int
    calls_successful: int
    calls_failed: int
    calls_rescheduled: int
    calls_pending: int
    success_rate: int
    avg_duration_seconds: int


class DashboardVolumePoint(BaseModel):
    date: str
    completed: int
    failed: int
    rescheduled: int


class DashboardActivityItem(BaseModel):
    call_id: str
    client_name: str
    phone_number: str
    status: str
    sentiment: str | None = None
    ended_at: datetime
    duration_seconds: int


class DashboardOverviewResponse(BaseModel):
    stats: DashboardStats
    call_volume: list[DashboardVolumePoint]
    recent_activity: list[DashboardActivityItem]
