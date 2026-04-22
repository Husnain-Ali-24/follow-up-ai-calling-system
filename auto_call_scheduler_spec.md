# Auto Call Scheduler & VAPI Integration — Developer Specification

**Module:** Automated Outbound Calling Engine  
**Stack:** FastAPI (Backend) + VAPI (Voice AI) + Redis + BullMQ-equivalent (ARQ for Python)  
**Environment:** Production-grade — all secrets via environment variables  
**Depends On:** Client Management Module (clients table must exist)  
**Document Purpose:** Complete implementation guide for Copilot — follow top to bottom

---

## Table of Contents
1. [Module Overview](#1-module-overview)
2. [Environment Variables](#2-environment-variables)
3. [Project Structure](#3-project-structure)
4. [Database — New Tables](#4-database--new-tables)
5. [VAPI Integration Layer](#5-vapi-integration-layer)
6. [Scheduler Worker](#6-scheduler-worker)
7. [Call Orchestration Worker](#7-call-orchestration-worker)
8. [Webhook Handler](#8-webhook-handler)
9. [Post-Call Processor](#9-post-call-processor)
10. [Retry Logic](#10-retry-logic)
11. [API Endpoints](#11-api-endpoints)
12. [Running in Production](#12-running-in-production)
13. [Testing Checklist](#13-testing-checklist)

---

## 1. Module Overview

### What This Module Does

Once a client is imported (status = `pending`), this module takes over completely — no human involvement needed. It:

1. **Scheduler** — polls DB every 30 seconds, finds clients whose `scheduled_call_time` has arrived
2. **Concurrency Gate** — ensures max 10 calls fire simultaneously (never more)
3. **VAPI Caller** — triggers the actual outbound call via VAPI API
4. **Webhook Receiver** — listens to VAPI events in real time (call started, ended, transcript, etc.)
5. **Post-Call Processor** — after call ends, generates AI summary, extracts answers, saves everything
6. **Retry Engine** — if call fails (no answer, busy, voicemail), auto-retries up to 3 times

### Key Rules (from PDF — must be enforced in code)
- Max **10 concurrent calls** at any time
- Only call between **9am–8pm client local time** (calling window — configurable via env)
- Retry failed calls up to **3 times** with delays: +30 min, +2 hours, next day same time
- Max **3 reschedules** per client — after that, mark `manual_follow_up_required`
- Hard cutoff: **10 minutes max** per call (configured in VAPI assistant)
- Never call a client with `is_active = false`
- Scheduler must **survive process restarts** — no in-memory state, everything in DB/Redis

### Architecture at a Glance

```
┌─────────────────────────────────────────────────────┐
│                  Every 30 seconds                    │
│                  Scheduler Worker                    │
│  SELECT due clients → check concurrency → enqueue   │
└──────────────────────┬──────────────────────────────┘
                       │ Redis Job Queue (ARQ)
                       ↓
┌─────────────────────────────────────────────────────┐
│              Call Orchestration Worker               │
│   Dequeues job → calls VAPI API → updates DB status  │
└──────────────────────┬──────────────────────────────┘
                       │ VAPI places call
                       ↓
┌─────────────────────────────────────────────────────┐
│                  VAPI (External)                     │
│   AI voice agent conducts conversation              │
│   Sends webhook events back to our server           │
└──────────────────────┬──────────────────────────────┘
                       │ POST /webhooks/vapi
                       ↓
┌─────────────────────────────────────────────────────┐
│               Webhook Handler (FastAPI)              │
│   Receives events → updates call state in DB         │
│   On call-ended → enqueues Post-Call Processor job   │
└──────────────────────┬──────────────────────────────┘
                       │
                       ↓
┌─────────────────────────────────────────────────────┐
│              Post-Call Processor Worker              │
│   Fetches transcript → LLM summary → saves to DB    │
└─────────────────────────────────────────────────────┘
```

---

## 2. Environment Variables

### `.env.example` — Commit this file. Never commit `.env`

```bash
# ── Database ────────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@localhost:5432/calling_db
# Production example: postgresql://user:pass@db.neon.tech:5432/calling_db?sslmode=require

# ── Redis (Job Queue) ────────────────────────────────────────────────────────
REDIS_URL=redis://localhost:6379
# Production example: redis://default:password@redis.railway.internal:6379

# ── VAPI ─────────────────────────────────────────────────────────────────────
VAPI_API_KEY=your_vapi_api_key_here
VAPI_PHONE_NUMBER_ID=your_vapi_phone_number_id   # The outbound phone number in VAPI
VAPI_ASSISTANT_ID=your_vapi_assistant_id          # Pre-configured assistant in VAPI dashboard
VAPI_WEBHOOK_SECRET=your_vapi_webhook_secret      # For signature verification on webhooks

# ── OpenAI (Post-call summarization) ────────────────────────────────────────
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini                          # Use gpt-4o-mini for cost efficiency

# ── Calling Window (applied per client's local timezone) ─────────────────────
CALLING_WINDOW_START=09:00                        # 9:00 AM
CALLING_WINDOW_END=20:00                          # 8:00 PM

# ── Retry Policy ─────────────────────────────────────────────────────────────
MAX_CALL_RETRIES=3
RETRY_DELAY_1_MINUTES=30                          # First retry: +30 minutes
RETRY_DELAY_2_MINUTES=120                         # Second retry: +2 hours
RETRY_DELAY_3_HOURS=24                            # Third retry: next day same time (hours)

# ── Concurrency ───────────────────────────────────────────────────────────────
MAX_CONCURRENT_CALLS=10

# ── Scheduler ─────────────────────────────────────────────────────────────────
SCHEDULER_TICK_SECONDS=30

# ── App ───────────────────────────────────────────────────────────────────────
APP_ENV=production                                # development | staging | production
BASE_URL=https://your-api-domain.com              # Public URL — VAPI sends webhooks here
SECRET_KEY=generate_a_long_random_string_here     # Used for webhook signature verification

# ── Sentry (Error Tracking) ───────────────────────────────────────────────────
SENTRY_DSN=https://your_sentry_dsn_here           # Leave blank to disable
```

### Loading Config Safely in Code

**`app/config.py`** — Single place to read all env vars. Never use `os.getenv()` scattered across files.

```python
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # Database
    database_url: str

    # Redis
    redis_url: str

    # VAPI
    vapi_api_key: str
    vapi_phone_number_id: str
    vapi_assistant_id: str
    vapi_webhook_secret: str

    # OpenAI
    openai_api_key: str
    openai_model: str = "gpt-4o-mini"

    # Calling window
    calling_window_start: str = "09:00"
    calling_window_end: str = "20:00"

    # Retry policy
    max_call_retries: int = 3
    retry_delay_1_minutes: int = 30
    retry_delay_2_minutes: int = 120
    retry_delay_3_hours: int = 24

    # Concurrency
    max_concurrent_calls: int = 10

    # Scheduler
    scheduler_tick_seconds: int = 30

    # App
    app_env: str = "production"
    base_url: str
    secret_key: str

    # Sentry (optional)
    sentry_dsn: str = ""

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """
    Cached settings — reads .env once at startup.
    Import and call this everywhere instead of os.getenv().
    Usage: from app.config import get_settings; settings = get_settings()
    """
    return Settings()
```

---

## 3. Project Structure

Add these files/folders to the existing backend structure:

```
backend/
├── app/
│   ├── config.py                        # ← NEW: All env vars in one place
│   ├── models/
│   │   ├── client.py                    # Already exists
│   │   └── call.py                      # ← NEW: calls + reschedules tables
│   ├── schemas/
│   │   └── call.py                      # ← NEW: Pydantic schemas for calls
│   ├── crud/
│   │   └── call.py                      # ← NEW: DB operations for calls
│   ├── routers/
│   │   ├── clients.py                   # Already exists
│   │   └── webhooks.py                  # ← NEW: /webhooks/vapi endpoint
│   ├── workers/
│   │   ├── __init__.py
│   │   ├── scheduler.py                 # ← NEW: Polls DB, enqueues due calls
│   │   ├── call_orchestrator.py         # ← NEW: Fires VAPI calls
│   │   └── post_call_processor.py       # ← NEW: Summary + data extraction
│   ├── services/
│   │   ├── vapi_client.py               # ← NEW: All VAPI API calls
│   │   ├── openai_client.py             # ← NEW: LLM summarization
│   │   └── calling_window.py            # ← NEW: Timezone + window checks
│   └── utils/
│       └── webhook_verifier.py          # ← NEW: VAPI signature verification
├── arq_worker.py                        # ← NEW: ARQ worker entry point
├── scheduler_runner.py                  # ← NEW: Scheduler entry point
└── requirements.txt                     # Add new deps (see Section 12)
```

---

## 4. Database — New Tables

Run these migrations AFTER the clients table already exists.

```sql
-- ── calls table ──────────────────────────────────────────────────────────────
-- Stores every call attempt (one client can have multiple attempts)

CREATE TYPE call_status AS ENUM (
    'initiated',      -- VAPI call triggered, waiting for pickup
    'in_progress',    -- Call connected and conversation active
    'completed',      -- Conversation finished successfully
    'no_answer',      -- Phone rang, nobody picked up
    'voicemail',      -- Reached voicemail
    'busy',           -- Line was busy
    'failed',         -- Technical error (VAPI/Twilio failure)
    'refused'         -- Client explicitly refused / said not interested
);

CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative');

CREATE TABLE calls (
    call_id             UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id           UUID            NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    vapi_call_id        VARCHAR(255)    UNIQUE,          -- VAPI's own call ID
    attempt_number      INTEGER         NOT NULL DEFAULT 1,
    status              call_status     NOT NULL DEFAULT 'initiated',
    started_at          TIMESTAMPTZ,
    ended_at            TIMESTAMPTZ,
    duration_seconds    INTEGER,
    transcript          TEXT,                            -- Full conversation transcript
    summary             TEXT,                            -- AI-generated summary (3-5 sentences)
    structured_answers  JSONB,                           -- Extracted key-value answers
    sentiment           sentiment_type,
    recording_url       TEXT,
    error_message       TEXT,                            -- If failed, why
    created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_calls_client_id    ON calls(client_id);
CREATE INDEX idx_calls_status       ON calls(status);
CREATE INDEX idx_calls_vapi_call_id ON calls(vapi_call_id);
CREATE INDEX idx_calls_started_at   ON calls(started_at);

-- Auto-update updated_at
CREATE TRIGGER calls_updated_at
    BEFORE UPDATE ON calls
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();  -- reuse function from clients migration


-- ── reschedules table ─────────────────────────────────────────────────────────
-- Logs every reschedule event for auditing

CREATE TABLE reschedules (
    reschedule_id   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id       UUID        NOT NULL REFERENCES clients(client_id) ON DELETE CASCADE,
    call_id         UUID        REFERENCES calls(call_id),   -- Call during which reschedule happened
    original_time   TIMESTAMPTZ NOT NULL,
    new_time        TIMESTAMPTZ NOT NULL,
    reason          TEXT,                                    -- Client's stated reason if captured
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reschedules_client_id ON reschedules(client_id);
```

---

## 5. VAPI Integration Layer

**`app/services/vapi_client.py`**

> This is the ONLY file that talks to VAPI. No other file should call VAPI directly.

```python
import httpx
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

VAPI_BASE_URL = "https://api.vapi.ai"


def _get_headers() -> dict:
    """Build auth headers. Called fresh every request so key rotation works."""
    return {
        "Authorization": f"Bearer {settings.vapi_api_key}",
        "Content-Type": "application/json",
    }


async def start_outbound_call(client: dict) -> dict:
    """
    Trigger an outbound call via VAPI for a single client.

    client dict must have:
        client_id, full_name, phone_number, follow_up_context,
        previous_interaction (optional), timezone

    Returns the VAPI call object (contains vapi_call_id we store in our DB).
    Raises httpx.HTTPStatusError on failure — let the caller handle it.
    """
    payload = {
        "phoneNumberId": settings.vapi_phone_number_id,
        "assistantId": settings.vapi_assistant_id,
        "customer": {
            "number": client["phone_number"],
            "name": client["full_name"],
        },
        # assistantOverrides injects client-specific data into the AI prompt at runtime
        "assistantOverrides": {
            "variableValues": {
                "client_name":            client["full_name"],
                "follow_up_context":      client["follow_up_context"],
                "previous_interaction":   client.get("previous_interaction") or "No previous interaction",
                "client_timezone":        client["timezone"],
                "internal_client_id":     str(client["client_id"]),  # We use this in webhook to find our record
            }
        },
    }

    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.post(
            f"{VAPI_BASE_URL}/call/phone",
            headers=_get_headers(),
            json=payload,
        )
        response.raise_for_status()  # Raises on 4xx/5xx
        data = response.json()
        logger.info(f"VAPI call started: vapi_call_id={data.get('id')} client_id={client['client_id']}")
        return data


async def get_call_details(vapi_call_id: str) -> dict:
    """
    Fetch full call details from VAPI (transcript, recording URL, etc.)
    Called by Post-Call Processor after call-ended webhook arrives.
    """
    async with httpx.AsyncClient(timeout=30.0) as http:
        response = await http.get(
            f"{VAPI_BASE_URL}/call/{vapi_call_id}",
            headers=_get_headers(),
        )
        response.raise_for_status()
        return response.json()


async def get_active_calls_count() -> int:
    """
    Ask VAPI how many calls are currently active.
    Used by the scheduler before firing new calls (concurrency gate).
    Falls back to 0 on error so we don't block forever.
    """
    try:
        async with httpx.AsyncClient(timeout=10.0) as http:
            response = await http.get(
                f"{VAPI_BASE_URL}/call",
                headers=_get_headers(),
                params={"status": "in-progress", "limit": 100},
            )
            response.raise_for_status()
            data = response.json()
            # VAPI returns { results: [...], total: N }
            return data.get("total", len(data.get("results", [])))
    except Exception as e:
        logger.warning(f"Could not fetch active VAPI call count: {e}. Defaulting to 0.")
        return 0
```

---

## 6. Scheduler Worker

**`app/workers/scheduler.py`**

> Runs as a separate process. Polls DB every 30 seconds.
> Finds due clients → checks concurrency → enqueues call jobs.
> Must be stateless — all state lives in DB and Redis.

```python
import asyncio
import logging
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.client import Client
from app.services.calling_window import is_within_calling_window
from app.services.vapi_client import get_active_calls_count
from app.workers.call_orchestrator import enqueue_call
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


def get_due_clients(db: Session) -> list[Client]:
    """
    Single efficient DB query to find all clients ready to be called right now.
    Uses indexed columns only — fast even at 100k rows.
    """
    now_utc = datetime.now(timezone.utc)
    return (
        db.query(Client)
        .filter(
            Client.status == "pending",
            Client.is_active == True,
            Client.scheduled_call_time <= now_utc,
        )
        .all()
    )


async def scheduler_tick():
    """
    One tick of the scheduler.
    1. Query due clients
    2. Check how many calls are currently active (concurrency gate)
    3. Enqueue up to (MAX_CONCURRENT_CALLS - active) new calls
    """
    db = SessionLocal()
    try:
        due_clients = get_due_clients(db)

        if not due_clients:
            logger.debug("Scheduler tick: no due clients")
            return

        logger.info(f"Scheduler tick: {len(due_clients)} due clients found")

        # ── Concurrency Gate ──────────────────────────────────────────────────
        active_count = await get_active_calls_count()
        available_slots = settings.max_concurrent_calls - active_count

        if available_slots <= 0:
            logger.info(f"Concurrency limit reached ({active_count} active). Waiting.")
            return

        # ── Filter by Calling Window ──────────────────────────────────────────
        # Each client may be in a different timezone — check individually
        callable_clients = [
            c for c in due_clients
            if is_within_calling_window(c.timezone)
        ]

        outside_window = len(due_clients) - len(callable_clients)
        if outside_window > 0:
            logger.info(f"{outside_window} clients skipped (outside calling window)")

        # ── Take Only What We Have Slots For ─────────────────────────────────
        to_call = callable_clients[:available_slots]

        for client in to_call:
            # Mark as in_progress immediately to prevent double-scheduling
            # on the next tick before VAPI confirms the call started
            client.status = "in_progress"
            db.commit()

            # Enqueue the actual VAPI call as a background job
            await enqueue_call(str(client.client_id))
            logger.info(f"Enqueued call for client_id={client.client_id} name={client.full_name}")

    except Exception as e:
        logger.error(f"Scheduler tick error: {e}", exc_info=True)
    finally:
        db.close()


async def run_scheduler():
    """
    Main scheduler loop. Runs forever until process is killed.
    Restarts gracefully after any error — never crashes the whole process.
    """
    logger.info(f"Scheduler started. Tick every {settings.scheduler_tick_seconds}s")
    while True:
        try:
            await scheduler_tick()
        except Exception as e:
            # Log but don't crash — next tick will retry
            logger.error(f"Unhandled scheduler error: {e}", exc_info=True)
        await asyncio.sleep(settings.scheduler_tick_seconds)
```

**`app/services/calling_window.py`**

```python
from datetime import datetime
import pytz
from app.config import get_settings

settings = get_settings()


def is_within_calling_window(client_timezone: str) -> bool:
    """
    Check if the current time in the client's local timezone falls
    within the configured calling window (e.g., 9:00 AM – 8:00 PM).

    Returns True if we can call, False if we must wait.
    """
    try:
        tz = pytz.timezone(client_timezone)
        local_now = datetime.now(tz)
        current_time = local_now.strftime("%H:%M")

        window_start = settings.calling_window_start  # e.g. "09:00"
        window_end   = settings.calling_window_end    # e.g. "20:00"

        return window_start <= current_time <= window_end

    except Exception:
        # If timezone is somehow invalid, default to allowing the call
        # so clients don't get permanently stuck
        return True


def next_valid_calling_time(client_timezone: str) -> datetime:
    """
    If we're outside the calling window, return the next datetime
    when calling is allowed (start of next window).
    Used by retry logic to schedule the next attempt.
    """
    tz = pytz.timezone(client_timezone)
    local_now = datetime.now(tz)
    window_start = settings.calling_window_start  # "09:00"

    start_hour, start_min = map(int, window_start.split(":"))

    # Try today's window start
    today_start = local_now.replace(hour=start_hour, minute=start_min, second=0, microsecond=0)

    if local_now < today_start:
        # We're before today's window — return today's start
        next_time = today_start
    else:
        # We're after today's window — return tomorrow's start
        from datetime import timedelta
        next_time = today_start + timedelta(days=1)

    # Convert back to UTC for storage
    return next_time.astimezone(pytz.utc)
```

---

## 7. Call Orchestration Worker

**`app/workers/call_orchestrator.py`**

> Dequeues a call job → validates client still callable → fires VAPI → saves call record.

```python
import logging
from uuid import UUID
from datetime import datetime, timezone

from sqlalchemy.orm import Session
from app.database import SessionLocal
from app.models.client import Client
from app.models.call import Call
from app.services.vapi_client import start_outbound_call
from app.config import get_settings

import arq  # ARQ is the Python Redis job queue library

logger = logging.getLogger(__name__)
settings = get_settings()


async def enqueue_call(client_id: str):
    """
    Push a call job onto the Redis queue.
    The ARQ worker picks it up and runs execute_call().
    """
    redis = await arq.create_pool(arq.connections.RedisSettings.from_dsn(settings.redis_url))
    await redis.enqueue_job("execute_call", client_id)
    await redis.close()


async def execute_call(ctx: dict, client_id: str):
    """
    ARQ job function — runs inside the ARQ worker process.
    ctx is provided by ARQ automatically.

    Flow:
    1. Re-validate client is still callable (guard against race conditions)
    2. Determine attempt number
    3. Create a call record in DB
    4. Fire VAPI call
    5. Save VAPI call ID against our call record
    """
    db: Session = SessionLocal()
    try:
        client = db.query(Client).filter(Client.client_id == UUID(client_id)).first()

        # ── Guard: client might have been deleted or deactivated since enqueue ──
        if not client:
            logger.warning(f"execute_call: client_id={client_id} not found. Skipping.")
            return

        if not client.is_active:
            logger.info(f"execute_call: client_id={client_id} is inactive. Skipping.")
            client.status = "pending"  # Reset so it doesn't stay in_progress forever
            db.commit()
            return

        # ── Determine attempt number ──────────────────────────────────────────
        from sqlalchemy import func
        attempt_number = (
            db.query(func.count(Call.call_id))
            .filter(Call.client_id == UUID(client_id))
            .scalar()
        ) + 1

        # ── Create call record BEFORE firing (so we have a record even if VAPI fails) ──
        call = Call(
            client_id=UUID(client_id),
            attempt_number=attempt_number,
            status="initiated",
            started_at=datetime.now(timezone.utc),
        )
        db.add(call)
        db.commit()
        db.refresh(call)

        # ── Fire VAPI call ────────────────────────────────────────────────────
        client_data = {
            "client_id":            client.client_id,
            "full_name":            client.full_name,
            "phone_number":         client.phone_number,
            "follow_up_context":    client.follow_up_context,
            "previous_interaction": client.previous_interaction,
            "timezone":             client.timezone,
        }

        vapi_response = await start_outbound_call(client_data)

        # ── Save VAPI call ID against our record ──────────────────────────────
        call.vapi_call_id = vapi_response.get("id")
        call.status = "in_progress"
        db.commit()

        logger.info(
            f"Call fired: call_id={call.call_id} vapi_call_id={call.vapi_call_id} "
            f"client={client.full_name} attempt={attempt_number}"
        )

    except Exception as e:
        logger.error(f"execute_call failed for client_id={client_id}: {e}", exc_info=True)

        # Reset client status so scheduler can retry
        if client:
            client.status = "failed"
            db.commit()

        # Save error to call record if we created one
        if call:
            call.status = "failed"
            call.error_message = str(e)
            db.commit()

        raise  # Re-raise so ARQ marks the job as failed

    finally:
        db.close()
```

**`app/models/call.py`** — SQLAlchemy model

```python
import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Integer, Text, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from app.database import Base

CALL_STATUSES = [
    "initiated", "in_progress", "completed",
    "no_answer", "voicemail", "busy", "failed", "refused"
]
SENTIMENTS = ["positive", "neutral", "negative"]


class Call(Base):
    __tablename__ = "calls"

    call_id            = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id          = Column(UUID(as_uuid=True), nullable=False)
    vapi_call_id       = Column(String(255), unique=True, nullable=True)
    attempt_number     = Column(Integer, nullable=False, default=1)
    status             = Column(SAEnum(*CALL_STATUSES, name="call_status"), nullable=False, default="initiated")
    started_at         = Column(DateTime(timezone=True), nullable=True)
    ended_at           = Column(DateTime(timezone=True), nullable=True)
    duration_seconds   = Column(Integer, nullable=True)
    transcript         = Column(Text, nullable=True)
    summary            = Column(Text, nullable=True)
    structured_answers = Column(JSONB, nullable=True)
    sentiment          = Column(SAEnum(*SENTIMENTS, name="sentiment_type"), nullable=True)
    recording_url      = Column(Text, nullable=True)
    error_message      = Column(Text, nullable=True)
    created_at         = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at         = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
```

---

## 8. Webhook Handler

**CRITICAL:** VAPI sends events to your server in real time. This endpoint must:
- Respond in **< 200ms** (just save to DB, push heavy work to queue)
- Verify the VAPI webhook signature (security — reject unsigned requests)
- Never do slow operations (no LLM calls, no heavy processing) inline

**`app/utils/webhook_verifier.py`**

```python
import hmac
import hashlib
from app.config import get_settings

settings = get_settings()


def verify_vapi_signature(payload_bytes: bytes, signature_header: str) -> bool:
    """
    Verify that the webhook actually came from VAPI.
    VAPI signs webhooks using HMAC-SHA256 with your webhook secret.
    REJECT any request that fails this check.
    """
    if not signature_header:
        return False

    expected = hmac.new(
        settings.vapi_webhook_secret.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()

    # Use hmac.compare_digest to prevent timing attacks
    return hmac.compare_digest(expected, signature_header)
```

**`app/routers/webhooks.py`**

```python
import logging
from fastapi import APIRouter, Request, HTTPException, BackgroundTasks

from app.utils.webhook_verifier import verify_vapi_signature
from app.workers.post_call_processor import enqueue_post_call_processing
from app.database import SessionLocal
from app.models.call import Call
from app.models.client import Client
from sqlalchemy.orm import Session
from datetime import datetime, timezone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["Webhooks"])


@router.post("/vapi")
async def vapi_webhook(request: Request, background_tasks: BackgroundTasks):
    """
    Receives all VAPI call events.
    Must respond in < 200ms — heavy work goes to background queue.

    VAPI event types we handle:
    - call-started      → update call status to in_progress
    - call-ended        → update call status, enqueue post-call processing
    - transcript        → optionally stream transcript updates
    - function-call     → handle AI mid-call actions (reschedule, mark-refused)
    """
    # ── 1. Read raw body FIRST (needed for signature verification) ────────────
    raw_body = await request.body()

    # ── 2. Verify VAPI signature ──────────────────────────────────────────────
    signature = request.headers.get("x-vapi-signature", "")
    if not verify_vapi_signature(raw_body, signature):
        logger.warning("Rejected webhook: invalid VAPI signature")
        raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # ── 3. Parse JSON ─────────────────────────────────────────────────────────
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = payload.get("message", {}).get("type") or payload.get("type")
    vapi_call_id = (
        payload.get("message", {}).get("call", {}).get("id")
        or payload.get("call", {}).get("id")
    )

    logger.info(f"VAPI webhook received: type={event_type} vapi_call_id={vapi_call_id}")

    # ── 4. Handle each event type ─────────────────────────────────────────────
    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(Call.vapi_call_id == vapi_call_id).first() if vapi_call_id else None

        if event_type == "call-started":
            _handle_call_started(db, call, payload)

        elif event_type == "call-ended":
            _handle_call_ended(db, call, payload)
            # Enqueue post-call processing as background job (heavy — LLM summary etc.)
            if call:
                background_tasks.add_task(enqueue_post_call_processing, str(call.call_id), vapi_call_id)

        elif event_type == "function-call":
            # AI triggered a mid-call action (e.g. book-reschedule, mark-refused)
            await _handle_function_call(db, call, payload)

    except Exception as e:
        logger.error(f"Webhook processing error: {e}", exc_info=True)
        # Still return 200 — VAPI will retry on non-200 which causes duplicate processing
    finally:
        db.close()

    # ── 5. Always return 200 immediately ─────────────────────────────────────
    return {"received": True}


def _handle_call_started(db: Session, call: Call, payload: dict):
    """Update call and client status when VAPI confirms the call connected."""
    if not call:
        return
    call.status = "in_progress"
    call.started_at = datetime.now(timezone.utc)
    db.commit()
    logger.info(f"Call started: call_id={call.call_id}")


def _handle_call_ended(db: Session, call: Call, payload: dict):
    """
    Update call record with end details.
    Map VAPI's ended reason to our status enum.
    """
    if not call:
        return

    ended_reason = (
        payload.get("message", {}).get("endedReason")
        or payload.get("endedReason", "")
    ).lower()

    # Map VAPI end reasons to our status values
    status_map = {
        "customer-did-not-answer": "no_answer",
        "voicemail":               "voicemail",
        "customer-busy":           "busy",
        "pipeline-error":          "failed",
        "assistant-ended-call":    "completed",
        "customer-ended-call":     "completed",
        "silence-timed-out":       "no_answer",
        "max-duration-exceeded":   "completed",
    }
    call.status = status_map.get(ended_reason, "completed")
    call.ended_at = datetime.now(timezone.utc)

    # Calculate duration
    if call.started_at and call.ended_at:
        delta = call.ended_at - call.started_at
        call.duration_seconds = int(delta.total_seconds())

    # Save recording URL if available
    recording_url = (
        payload.get("message", {}).get("recordingUrl")
        or payload.get("recordingUrl")
    )
    if recording_url:
        call.recording_url = recording_url

    db.commit()

    # ── Update client status based on call outcome ────────────────────────────
    client = db.query(Client).filter(Client.client_id == call.client_id).first()
    if client:
        if call.status == "completed":
            client.status = "completed"
        elif call.status in ("no_answer", "voicemail", "busy", "failed"):
            # Retry logic handles setting status back to pending with new scheduled time
            _schedule_retry(db, client, call)
        db.commit()

    logger.info(f"Call ended: call_id={call.call_id} status={call.status} duration={call.duration_seconds}s")


async def _handle_function_call(db: Session, call: Call, payload: dict):
    """
    Handle mid-call AI function calls.
    The VAPI assistant calls these when it detects certain intents.

    Supported functions:
    - book_reschedule   → client wants to be called at a different time
    - mark_refused      → client is not interested
    - confirm_details   → AI confirmed key information with client
    """
    function_name = payload.get("message", {}).get("functionCall", {}).get("name")
    parameters    = payload.get("message", {}).get("functionCall", {}).get("parameters", {})

    if not call or not function_name:
        return

    client = db.query(Client).filter(Client.client_id == call.client_id).first()
    if not client:
        return

    if function_name == "book_reschedule":
        await _process_reschedule(db, client, call, parameters)

    elif function_name == "mark_refused":
        client.status = "refused"
        call.status   = "refused"
        db.commit()
        logger.info(f"Client refused: client_id={client.client_id}")

    elif function_name == "confirm_details":
        # Save confirmed details to call's structured_answers
        if call.structured_answers is None:
            call.structured_answers = {}
        call.structured_answers["confirmed"] = parameters
        db.commit()


async def _process_reschedule(db: Session, client: Client, call: Call, params: dict):
    """
    Handle a reschedule request from mid-call function call.
    Validates reschedule count, parses new time, saves to DB.
    """
    from app.models.call import Reschedule  # Import here to avoid circular imports
    from app.services.calling_window import next_valid_calling_time
    import pytz
    from datetime import datetime

    # ── Check reschedule limit ────────────────────────────────────────────────
    if client.reschedule_count >= 3:
        client.status = "manual_follow_up_required"
        db.commit()
        logger.info(f"Max reschedules reached for client_id={client.client_id}")
        return

    # ── Parse new time from AI-extracted parameters ───────────────────────────
    new_time_str = params.get("new_datetime")  # e.g. "2026-05-10T14:00:00"
    try:
        tz = pytz.timezone(client.timezone)
        naive_dt = datetime.fromisoformat(new_time_str)
        new_time_utc = tz.localize(naive_dt).astimezone(pytz.utc)
    except Exception as e:
        logger.error(f"Failed to parse reschedule time '{new_time_str}': {e}")
        # Fall back to next valid calling window
        new_time_utc = next_valid_calling_time(client.timezone)

    # ── Ensure new time is within calling window — if not, push to next window ─
    from app.services.calling_window import is_within_calling_window
    # Convert back to local time for window check
    local_new_time = new_time_utc.astimezone(pytz.timezone(client.timezone))
    local_time_str = local_new_time.strftime("%H:%M")
    if not (settings_calling_start() <= local_time_str <= settings_calling_end()):
        new_time_utc = next_valid_calling_time(client.timezone)

    # ── Save reschedule record ────────────────────────────────────────────────
    reschedule = Reschedule(
        client_id=client.client_id,
        call_id=call.call_id,
        original_time=client.scheduled_call_time,
        new_time=new_time_utc,
        reason=params.get("reason", ""),
    )
    db.add(reschedule)

    # ── Update client ─────────────────────────────────────────────────────────
    client.scheduled_call_time = new_time_utc
    client.status              = "rescheduled"
    client.reschedule_count    += 1
    db.commit()

    logger.info(
        f"Rescheduled client_id={client.client_id} "
        f"to {new_time_utc} (attempt {client.reschedule_count}/3)"
    )


def _schedule_retry(db: Session, client: Client, call: Call):
    """
    Schedule next retry attempt based on attempt number.
    Retry delays (from env):
      Attempt 1 failed → retry in 30 min
      Attempt 2 failed → retry in 2 hours
      Attempt 3 failed → retry next day same time
      Attempt 4+ failed → mark manual_follow_up_required
    """
    from datetime import timedelta
    from app.config import get_settings
    settings = get_settings()

    if call.attempt_number >= settings.max_call_retries:
        client.status = "manual_follow_up_required"
        logger.info(f"Max retries reached for client_id={client.client_id}")
        return

    now_utc = datetime.now(timezone.utc)

    if call.attempt_number == 1:
        next_call = now_utc + timedelta(minutes=settings.retry_delay_1_minutes)
    elif call.attempt_number == 2:
        next_call = now_utc + timedelta(minutes=settings.retry_delay_2_minutes)
    else:
        next_call = now_utc + timedelta(hours=settings.retry_delay_3_hours)

    client.scheduled_call_time = next_call
    client.status = "pending"  # Back to pending so scheduler picks it up again
    logger.info(
        f"Retry scheduled: client_id={client.client_id} "
        f"attempt={call.attempt_number} next_call={next_call}"
    )


def settings_calling_start():
    return get_settings().calling_window_start

def settings_calling_end():
    return get_settings().calling_window_end
```

---

## 9. Post-Call Processor

**`app/workers/post_call_processor.py`**

> Runs after every completed call. Fetches transcript from VAPI → sends to LLM → saves summary + structured answers + sentiment to DB.
> Designed to be resilient: if OpenAI is down, raw transcript is still saved and processing retries later.

```python
import logging
from uuid import UUID

import arq
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import SessionLocal
from app.models.call import Call
from app.services.vapi_client import get_call_details
from app.services.openai_client import summarize_call

logger = logging.getLogger(__name__)
settings = get_settings()


async def enqueue_post_call_processing(call_id: str, vapi_call_id: str):
    """Push post-call processing job to Redis queue."""
    redis = await arq.create_pool(arq.connections.RedisSettings.from_dsn(settings.redis_url))
    await redis.enqueue_job("process_completed_call", call_id, vapi_call_id)
    await redis.close()


async def process_completed_call(ctx: dict, call_id: str, vapi_call_id: str):
    """
    ARQ job: runs after a call ends.
    1. Fetch full call details from VAPI (transcript, recording URL)
    2. Send transcript to OpenAI for summary + structured extraction
    3. Save everything to DB
    Graceful degradation: if OpenAI fails, saves raw transcript and retries later.
    """
    db: Session = SessionLocal()
    try:
        call = db.query(Call).filter(Call.call_id == UUID(call_id)).first()
        if not call:
            logger.warning(f"process_completed_call: call_id={call_id} not found")
            return

        # ── Step 1: Fetch transcript + details from VAPI ─────────────────────
        try:
            vapi_data = await get_call_details(vapi_call_id)
            transcript = _extract_transcript(vapi_data)
            recording_url = vapi_data.get("recordingUrl") or vapi_data.get("stereoRecordingUrl")

            call.transcript = transcript
            if recording_url:
                call.recording_url = recording_url
            db.commit()

        except Exception as e:
            logger.error(f"Failed to fetch VAPI call details for {vapi_call_id}: {e}")
            transcript = None  # Continue — we'll still try to summarize if transcript exists

        # ── Step 2: LLM Summary + Extraction ─────────────────────────────────
        if transcript:
            try:
                summary_result = await summarize_call(transcript)
                call.summary            = summary_result.get("summary")
                call.structured_answers = summary_result.get("structured_answers")
                call.sentiment          = summary_result.get("sentiment", "neutral")
                db.commit()
                logger.info(f"Post-call processing complete: call_id={call_id}")

            except Exception as e:
                # OpenAI down — don't fail the whole job, just log and move on.
                # Raw transcript is already saved. Operator can still see it.
                logger.error(f"LLM summarization failed for call_id={call_id}: {e}")
                # Do NOT raise — job completes successfully, transcript is preserved
        else:
            logger.warning(f"No transcript available for call_id={call_id}")

    except Exception as e:
        logger.error(f"process_completed_call failed: {e}", exc_info=True)
        raise  # Re-raise so ARQ can retry
    finally:
        db.close()


def _extract_transcript(vapi_data: dict) -> str:
    """
    Extract clean transcript text from VAPI call data.
    VAPI returns transcript as a list of message objects.
    We format them as: "ROLE: message text"
    """
    messages = vapi_data.get("transcript") or vapi_data.get("messages", [])

    if isinstance(messages, str):
        return messages  # Already a string

    lines = []
    for msg in messages:
        role    = msg.get("role", "unknown").upper()
        content = msg.get("message") or msg.get("content") or ""
        if content:
            lines.append(f"{role}: {content}")

    return "\n".join(lines)
```

**`app/services/openai_client.py`**

```python
import json
import logging
from openai import AsyncOpenAI
from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

# Initialize once — reused across all calls
openai_client = AsyncOpenAI(api_key=settings.openai_api_key)

SUMMARIZATION_PROMPT = """
You are analyzing a transcript from an AI-conducted follow-up phone call.
Extract the following and return ONLY valid JSON, no extra text:

{
  "summary": "3-5 sentence summary of what happened in the call",
  "sentiment": "positive | neutral | negative",
  "structured_answers": {
    "client_available": "yes | no | rescheduled",
    "main_concern": "what the client's main concern or response was",
    "next_action": "what was agreed as the next step",
    "key_information": "any important details mentioned by the client"
  }
}

Transcript:
{transcript}
"""


async def summarize_call(transcript: str) -> dict:
    """
    Send call transcript to OpenAI and extract structured summary.
    Returns a dict with keys: summary, sentiment, structured_answers.
    Raises on failure — caller handles graceful degradation.
    """
    prompt = SUMMARIZATION_PROMPT.replace("{transcript}", transcript[:8000])  # Truncate to avoid token limits

    response = await openai_client.chat.completions.create(
        model=settings.openai_model,
        messages=[
            {"role": "system", "content": "You are a call analysis assistant. Return only valid JSON."},
            {"role": "user",   "content": prompt},
        ],
        temperature=0.1,      # Low temperature for consistent structured output
        max_tokens=800,
        response_format={"type": "json_object"},  # Force JSON output
    )

    raw = response.choices[0].message.content
    result = json.loads(raw)

    # Validate sentiment is one of our allowed values
    if result.get("sentiment") not in ("positive", "neutral", "negative"):
        result["sentiment"] = "neutral"

    return result
```

---

## 10. Retry Logic

The retry logic lives inside `_schedule_retry()` in `webhooks.py` (Section 8). Here is the complete decision tree for reference:

```
Call ends with status: no_answer | voicemail | busy | failed
              ↓
    attempt_number == 1?
         YES → schedule retry in +30 min → status = pending
              ↓
    attempt_number == 2?
         YES → schedule retry in +2 hours → status = pending
              ↓
    attempt_number == 3?
         YES → schedule retry next day same time → status = pending
              ↓
    attempt_number >= MAX_CALL_RETRIES (default 3)?
         YES → status = manual_follow_up_required
               (operator must review manually)

Call ends with status: completed → status = completed (no retry)
Call ends with status: refused   → status = refused   (no retry)
```

**Important:** When status is set back to `pending` with a new `scheduled_call_time`, the scheduler will automatically pick it up on the next tick. No extra code needed.

---

## 11. API Endpoints

Register in `app/main.py`:

```python
from app.routers import clients, webhooks
app.include_router(webhooks.router)
```

| Method | Endpoint | Purpose |
|---|---|---|
| `POST` | `/webhooks/vapi` | Receive all VAPI events (public, signature-verified) |
| `GET` | `/calls` | List all calls with filters (date, status, client) |
| `GET` | `/calls/{call_id}` | Full call detail with transcript + summary |
| `POST` | `/clients/{client_id}/call-now` | Trigger immediate call (bypasses scheduled time) |
| `GET` | `/dashboard/stats` | Calls today, success rate, pending count |

**`call-now` endpoint** — triggers immediate call for a client regardless of scheduled time:

```python
# In app/routers/clients.py — add this endpoint

@router.post("/{client_id}/call-now", response_model=dict)
async def call_now(client_id: UUID, db: Session = Depends(get_db)):
    """
    Immediately trigger a call for a client — ignores scheduled_call_time.
    Sets status to in_progress and enqueues the call job.
    """
    client = crud.get_client(db, client_id)
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    if not client.is_active:
        raise HTTPException(status_code=400, detail="Client is inactive")
    if client.status == "in_progress":
        raise HTTPException(status_code=400, detail="Call already in progress for this client")

    client.status = "in_progress"
    db.commit()

    await enqueue_call(str(client_id))
    return {"message": "Call enqueued", "client_id": str(client_id)}
```

---

## 12. Running in Production

### Install Dependencies

Add to `requirements.txt`:
```
arq==0.25.0
redis==5.0.1
httpx==0.27.0
openai==1.30.0
pytz==2024.1
pydantic-settings==2.2.1
sentry-sdk[fastapi]==1.45.0
```

### ARQ Worker Entry Point

**`arq_worker.py`** — runs as a separate process in production

```python
from arq import cron
from arq.connections import RedisSettings
from app.workers.call_orchestrator import execute_call
from app.workers.post_call_processor import process_completed_call
from app.config import get_settings

settings = get_settings()


class WorkerSettings:
    """
    ARQ worker configuration.
    All job functions must be listed in functions[].
    """
    redis_settings = RedisSettings.from_dsn(settings.redis_url)
    functions = [
        execute_call,
        process_completed_call,
    ]
    max_jobs = settings.max_concurrent_calls   # Matches our concurrency limit
    job_timeout = 700                           # 10 min + buffer (matches VAPI max call length)
    keep_result = 3600                          # Keep job results for 1 hour (for debugging)
```

### Scheduler Entry Point

**`scheduler_runner.py`**

```python
import asyncio
import logging
import sentry_sdk
from app.workers.scheduler import run_scheduler
from app.config import get_settings

settings = get_settings()

# ── Initialize Sentry for error tracking ──────────────────────────────────────
if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        traces_sample_rate=0.1,
    )

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

if __name__ == "__main__":
    asyncio.run(run_scheduler())
```

### Process Commands

```bash
# Run FastAPI server (handles webhooks + API)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 2

# Run ARQ worker (handles call execution + post-call processing)
arq arq_worker.WorkerSettings

# Run Scheduler (polls DB, enqueues due calls)
python scheduler_runner.py
```

### Production Deployment (Railway / Render / Fly.io)

You need **3 separate processes** running simultaneously. In `Procfile` or platform config:

```
web:       uvicorn app.main:app --host 0.0.0.0 --port $PORT --workers 2
worker:    arq arq_worker.WorkerSettings
scheduler: python scheduler_runner.py
```

> On Railway: add 3 services from the same repo, each with a different start command.
> On Render: use one Web Service + two Background Workers.
> On Fly.io: use `[processes]` in `fly.toml`.

### VAPI Webhook URL

Once deployed, set this URL in your VAPI dashboard as the webhook endpoint:

```
https://your-api-domain.com/webhooks/vapi
```

> The `BASE_URL` env var must match your actual production domain exactly.

### Sentry Error Tracking

Add to `app/main.py` for FastAPI error tracking:

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from app.config import get_settings

settings = get_settings()

if settings.sentry_dsn:
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        environment=settings.app_env,
        integrations=[FastApiIntegration()],
        traces_sample_rate=0.1,
    )
```

### Health Check Endpoint

Add to `app/main.py` — monitored by your hosting platform:

```python
from sqlalchemy import text

@app.get("/health")
async def health(db: Session = Depends(get_db)):
    """
    Returns 200 if API + DB are healthy.
    Your hosting platform pings this to confirm the service is alive.
    """
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok", "env": settings.app_env}
    except Exception:
        raise HTTPException(status_code=503, detail="Database unavailable")
```

---

## 13. Testing Checklist

### Environment & Config
- [ ] `.env` is in `.gitignore` — never committed
- [ ] `.env.example` exists with all keys and sample values
- [ ] App crashes with clear error on startup if a required env var is missing

### Scheduler
- [ ] Scheduler fires every 30 seconds (check logs)
- [ ] Client with `scheduled_call_time` in the past and `status=pending` is picked up
- [ ] Client with `is_active=false` is skipped
- [ ] Client outside calling window (e.g., 2am local time) is skipped
- [ ] Scheduler respects `MAX_CONCURRENT_CALLS` — does not enqueue more than 10 at once
- [ ] After process restart, pending clients are picked up on next tick (no data loss)

### VAPI Integration
- [ ] `start_outbound_call()` sends correct `assistantOverrides` with client's name and context
- [ ] VAPI call ID is saved to our `calls` table
- [ ] `get_active_calls_count()` returns correct count (test with live VAPI calls)

### Webhooks
- [ ] Webhook endpoint rejects requests without valid VAPI signature (returns 401)
- [ ] `call-started` event → `calls.status` updated to `in_progress`
- [ ] `call-ended` event → `calls.status`, `ended_at`, `duration_seconds` all updated
- [ ] `call-ended` event → post-call processing job enqueued within < 200ms
- [ ] `function-call: book_reschedule` → client `scheduled_call_time` updated, `reschedule_count` incremented, reschedule row inserted
- [ ] `function-call: mark_refused` → client status = `refused`

### Retry Logic
- [ ] No-answer call → client status back to `pending` with new `scheduled_call_time` in +30 min
- [ ] Second failed attempt → retry in +2 hours
- [ ] Third failed attempt → retry next day
- [ ] Fourth failed attempt → status = `manual_follow_up_required` (no more retries)
- [ ] Completed call → no retry scheduled

### Post-Call Processor
- [ ] Transcript is saved to `calls.transcript` after call ends
- [ ] `calls.summary` populated with 3–5 sentence summary
- [ ] `calls.structured_answers` contains valid JSON
- [ ] `calls.sentiment` is one of: positive, neutral, negative
- [ ] If OpenAI is down — transcript still saved, no crash, job completes gracefully

### Production
- [ ] All 3 processes (web, worker, scheduler) running simultaneously
- [ ] VAPI webhook URL set in VAPI dashboard pointing to production domain
- [ ] Sentry receiving errors (trigger a deliberate error to confirm)
- [ ] `/health` endpoint returns 200
- [ ] Load test: 10 clients all scheduled for same time → exactly 10 concurrent calls, no more

---

*End of Auto Call Scheduler & VAPI Integration Specification*  
*Next section to implement: Post-Call Dashboard & Reporting*
