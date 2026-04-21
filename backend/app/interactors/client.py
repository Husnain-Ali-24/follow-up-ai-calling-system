from uuid import UUID
from typing import List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_
from sqlalchemy.orm.attributes import flag_modified

from app.models.client import Client, ClientStatus
from app.schemas.client import ClientCreate, ClientUpdate

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

def create_client(db: Session, client: ClientCreate) -> Client:
    db_client = Client(
        full_name=client.full_name,
        phone_number=client.phone_number,
        email=client.email,
        follow_up_context=client.follow_up_context,
        previous_interaction=client.previous_interaction,
        scheduled_call_time=client.scheduled_call_time,
        timezone=client.timezone,
        notes=client.notes,
        custom_fields=client.custom_fields or {},
        status=ClientStatus.PENDING
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
