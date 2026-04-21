import uuid
import enum
from sqlalchemy import Column, String, Text, DateTime, Enum, JSON, func
from sqlalchemy.dialects.postgresql import UUID
from app.database.base import Base

class ClientStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    RESCHEDULED = "rescheduled"

class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    full_name = Column(String, nullable=False)
    phone_number = Column(String, nullable=False, unique=True)
    email = Column(String, nullable=True)
    follow_up_context = Column(Text, nullable=False)
    previous_interaction = Column(Text, nullable=True)
    scheduled_call_time = Column(DateTime(timezone=True), nullable=True)
    timezone = Column(String, nullable=False, default="UTC")
    status = Column(Enum(ClientStatus), nullable=False, default=ClientStatus.PENDING)
    notes = Column(Text, nullable=True)
    custom_fields = Column(JSON, default=dict)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
