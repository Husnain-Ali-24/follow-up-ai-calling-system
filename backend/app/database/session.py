from pathlib import Path

from sqlalchemy.engine import make_url
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


database_url = make_url(settings.database_url)
engine_options = {"pool_pre_ping": True}

if database_url.get_backend_name() == "sqlite":
    engine_options["connect_args"] = {"check_same_thread": False}
    database_file = database_url.database
    if database_file and database_file != ":memory:":
        Path(database_file).parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(settings.database_url, **engine_options)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
)
