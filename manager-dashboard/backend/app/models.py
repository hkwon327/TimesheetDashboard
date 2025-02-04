# models.py
import enum
from datetime import datetime, date
from sqlalchemy import (
    Column, Integer, String, Date, DateTime, Enum as SqlEnum, func
)
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class SubmissionStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    confirmed = "confirmed"
    archived = "archived"  # 이전에 confirmed 되었던 데이터가 새 confirmed 시 archive 처리

class ManagerSubmission(Base):
    __tablename__ = "manager_submissions"
    
    submission_id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    interpreter_name = Column(String(100), nullable=False)
    request_date = Column(Date, nullable=False)
    requestor_name = Column(String(100), nullable=False)
    affiliated_unit = Column(String(100), nullable=False)
    service_location = Column(String(100), nullable=False)
    service_time = Column(String(50), nullable=False)
    purpose = Column(String(255), nullable=False)
    status = Column(SqlEnum(SubmissionStatus), nullable=False, default=SubmissionStatus.pending)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)
