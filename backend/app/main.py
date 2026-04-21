from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from app.core.config import settings
from app.database.base import Base
from app.database.session import engine
from app.models import User  # noqa: F401
from app.routes import auth, health, client
from app.seed import seed_default_admin

STATIC_DIR = Path(__file__).resolve().parent / "static"
INDEX_FILE = STATIC_DIR / "index.html"


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed_default_admin()
    yield


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


@app.get("/", include_in_schema=False)
def serve_root():
    return FileResponse(INDEX_FILE)


@app.get("/{file_path:path}", include_in_schema=False)
def serve_spa(file_path: str):
    requested_path = STATIC_DIR / file_path
    if requested_path.is_file():
        return FileResponse(requested_path)

    return FileResponse(INDEX_FILE)
