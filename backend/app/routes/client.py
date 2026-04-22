from typing import Annotated, List, Any
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
import csv
import io

from app.database.dependencies import get_db
from app.models.user import User
from app.routes.auth import get_authenticated_user
from app.schemas.client import ClientCreate, ClientResponse, ClientUpdate
from app.interactors.client import (
    get_clients,
    get_client,
    create_client,
    update_client,
    delete_client,
    get_client_by_phone,
    get_client_by_phone_excluding_id,
)

router = APIRouter(prefix="/clients", tags=["clients"])

@router.get("/", response_model=List[ClientResponse])
def read_clients(
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    return get_clients(db, skip=skip, limit=limit, search=search)

@router.post("/", response_model=ClientResponse, status_code=status.HTTP_201_CREATED)
def create_new_client(
    client: ClientCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    db_client = get_client_by_phone(db, client.phone_number)
    if db_client:
        raise HTTPException(status_code=400, detail="Phone number already registered")
    return create_client(db, client)

@router.post("/import")
def import_clients(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")
    
    content = file.file.read().decode('utf-8')
    csv_reader = csv.DictReader(io.StringIO(content))
    
    imported = 0
    errors = []
    seen_phone_numbers: set[str] = set()
    
    for row in csv_reader:
        phone = row.get('phone_number') or row.get('phone')
        name = row.get('full_name') or row.get('name')
        scheduled_call_time = (
            row.get('scheduled_call_time')
            or row.get('scheduled_at')
            or row.get('schedule_time')
            or row.get('call_time')
        )
        
        if not phone or not name:
            errors.append({"row": row, "error": "Missing phone or name"})
            continue
            
        context = row.get('follow_up_context') or "Imported via CSV"
        
        # Collect custom fields
        standard_fields = [
            'phone_number', 'phone', 'full_name', 'name', 'email',
            'follow_up_context', 'previous_interaction', 'scheduled_call_time',
            'scheduled_at', 'schedule_time', 'call_time', 'timezone', 'notes'
        ]
        custom_fields = {k: v for k, v in row.items() if k not in standard_fields and v}
        
        try:
            client_in = ClientCreate(
                full_name=name,
                phone_number=phone,
                email=row.get('email'),
                follow_up_context=context,
                previous_interaction=row.get('previous_interaction'),
                scheduled_call_time=scheduled_call_time,
                timezone=row.get('timezone'),
                notes=row.get('notes'),
                custom_fields=custom_fields
            )
        except Exception as exc:
            errors.append({"row": row, "error": str(exc)})
            continue

        if client_in.phone_number in seen_phone_numbers:
            errors.append({"row": row, "error": "Phone already exists in this import file"})
            continue
        seen_phone_numbers.add(client_in.phone_number)
        
        db_client = get_client_by_phone(db, client_in.phone_number)
        if not db_client:
            create_client(db, client_in)
            imported += 1
        else:
            errors.append({"row": row, "error": f"Phone {client_in.phone_number} already exists"})
            
    return {"message": f"Imported {imported} clients", "errors": errors}

@router.post("/bulk", response_model=dict, status_code=status.HTTP_201_CREATED)
def bulk_create_clients(
    clients: List[ClientCreate],
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    imported = 0
    errors = []
    seen_phone_numbers: set[str] = set()
    
    for idx, client in enumerate(clients):
        if client.phone_number in seen_phone_numbers:
            errors.append({"row": idx, "error": f"Phone {client.phone_number} is duplicated in this import payload"})
            continue
        seen_phone_numbers.add(client.phone_number)

        db_client = get_client_by_phone(db, client.phone_number)
        if not db_client:
            create_client(db, client)
            imported += 1
        else:
            errors.append({"row": idx, "error": f"Phone {client.phone_number} already exists"})
            
    return {"message": f"Imported {imported} clients", "errors": errors}

@router.get("/{client_id}", response_model=ClientResponse)
def read_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    db_client = get_client(db, client_id)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client

@router.patch("/{client_id}", response_model=ClientResponse)
def update_existing_client(
    client_id: UUID,
    client: ClientUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    if client.phone_number is not None:
        db_client = get_client_by_phone_excluding_id(db, client.phone_number, client_id)
        if db_client:
            raise HTTPException(status_code=400, detail="Phone number already registered")

    db_client = update_client(db, client_id, client)
    if db_client is None:
        raise HTTPException(status_code=404, detail="Client not found")
    return db_client

@router.delete("/{client_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_existing_client(
    client_id: UUID,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_authenticated_user)
):
    success = delete_client(db, client_id)
    if not success:
        raise HTTPException(status_code=404, detail="Client not found")
    return None
