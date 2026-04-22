from uuid import UUID
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.orm.attributes import flag_modified

from app.models.client import Client, ClientStatus
from app.schemas.client import ClientCreate, ClientUpdate
from app.services.calling_window import get_effective_calling_window
from app.services.client_scheduling import resolve_lead_timezone, resolve_scheduled_call_time

def get_clients(db: Session, skip: int = 0, limit: int = 100, search: Optional[str] = None) -> List[Client]:
    query = db.query(Client)
    if search:
        query = query.filter(
            or_(
                Client.full_name.ilike(f"%{search}%"),
                Client.phone_number.ilike(f"%{search}%"),
                Client.email.ilike(f"%{search}%")
            )
        )
    return query.order_by(Client.created_at.desc()).offset(skip).limit(limit).all()

def get_client(db: Session, client_id: UUID) -> Optional[Client]:
    return db.query(Client).filter(Client.id == client_id).first()

def get_client_by_phone(db: Session, phone_number: str) -> Optional[Client]:
    return db.query(Client).filter(Client.phone_number == phone_number).first()


def get_client_by_phone_excluding_id(db: Session, phone_number: str, client_id: UUID) -> Optional[Client]:
    return (
        db.query(Client)
        .filter(
            Client.phone_number == phone_number,
            Client.id != client_id,
        )
        .first()
    )

def create_client(db: Session, client: ClientCreate) -> Client:
    call_window = get_effective_calling_window(db)
    timezone_name = resolve_lead_timezone(client.phone_number, client.timezone)
    scheduled_time = resolve_scheduled_call_time(
        scheduled_call_time=client.scheduled_call_time,
        timezone_name=timezone_name,
        call_window=call_window,
    )

    db_client = Client(
        full_name=client.full_name,
        phone_number=client.phone_number,
        email=client.email,
        follow_up_context=client.follow_up_context,
        previous_interaction=client.previous_interaction,
        scheduled_call_time=scheduled_time,
        timezone=timezone_name,
        notes=client.notes,
        custom_fields=client.custom_fields or {},
        status=ClientStatus.PENDING,
        is_active=True,
        reschedule_count=0,
    )
    db.add(db_client)
    db.commit()
    db.refresh(db_client)
    return db_client

def update_client(db: Session, client_id: UUID, client_update: ClientUpdate) -> Optional[Client]:
    db_client = get_client(db, client_id)
    if not db_client:
        return None

    update_data = client_update.model_dump(exclude_unset=True)
    call_window = get_effective_calling_window(db)
    next_phone_number = update_data.get("phone_number", db_client.phone_number)

    if "timezone" in update_data:
        update_data["timezone"] = resolve_lead_timezone(
            next_phone_number,
            update_data.get("timezone"),
        )
    timezone_name = update_data.get("timezone", db_client.timezone)

    if "scheduled_call_time" in update_data:
        update_data["scheduled_call_time"] = resolve_scheduled_call_time(
            scheduled_call_time=update_data["scheduled_call_time"],
            timezone_name=timezone_name,
            call_window=call_window,
        )

    for key, value in update_data.items():
        setattr(db_client, key, value)

    # SQLAlchemy cannot auto-detect mutations inside JSON columns;
    if 'custom_fields' in update_data:
        # Ensure it's a dict and never None
        new_val = update_data['custom_fields'] or {}
        db_client.custom_fields = dict(new_val)
        flag_modified(db_client, 'custom_fields')

    db.commit()
    db.refresh(db_client)
    return db_client

def delete_client(db: Session, client_id: UUID) -> bool:
    db_client = get_client(db, client_id)
    if not db_client:
        return False
    db.delete(db_client)
    db.commit()
    return True
