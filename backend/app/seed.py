from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import hash_password
from app.database.base import Base
from app.database.session import engine, SessionLocal
from app.database.users import get_user_by_email, create_user


def seed_default_admin() -> None:
    Base.metadata.create_all(bind=engine)

    db: Session = SessionLocal()
    try:
        admin = get_user_by_email(db, settings.default_admin_email)
        if admin is None:
            create_user(
                db,
                email=settings.default_admin_email,
                hashed_password=hash_password(settings.default_admin_password),
                full_name=settings.default_admin_full_name,
                is_superuser=True,
            )
    finally:
        db.close()


if __name__ == "__main__":
    seed_default_admin()
