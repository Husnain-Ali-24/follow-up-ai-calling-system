import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

from app.core.config import settings
from app.database.base import Base
from app.database.session import engine
from app.models import AppSettings, Call, Client, Reschedule, User  # noqa: F401
from app.routes import auth, health, client, settings as settings_route, webhooks
from app.services.call_scheduler import run_scheduler_loop, shutdown_scheduler
from app.seed import seed_default_admin

STATIC_DIR = Path(__file__).resolve().parent / "static"
INDEX_FILE = STATIC_DIR / "index.html"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    scheduler_task = None
    if settings.scheduler_enabled:
        scheduler_task = asyncio.create_task(run_scheduler_loop())

    try:
        yield
    finally:
        await shutdown_scheduler(scheduler_task)


app = FastAPI(
    title=settings.app_name,
    debug=settings.app_debug,
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, prefix=settings.api_v1_prefix)
app.include_router(auth.router, prefix=settings.api_v1_prefix)
app.include_router(client.router, prefix=settings.api_v1_prefix)
app.include_router(settings_route.router, prefix=settings.api_v1_prefix)
app.include_router(webhooks.router, prefix=settings.api_v1_prefix)


@app.get("/", include_in_schema=False)
def serve_root():
    return FileResponse(INDEX_FILE)


@app.get("/{file_path:path}", include_in_schema=False)
def serve_spa(file_path: str):
    requested_path = STATIC_DIR / file_path
    if requested_path.is_file():
        return FileResponse(requested_path)

    return FileResponse(INDEX_FILE)
