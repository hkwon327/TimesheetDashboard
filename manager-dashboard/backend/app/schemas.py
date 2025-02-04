# schemas.py
from datetime import date, datetime
from pydantic import BaseModel
from typing import Optional
from models import SubmissionStatus

class SubmissionCreate(BaseModel):
    interpreter_name: str
    request_date: date
    requestor_name: str
    affiliated_unit: str
    service_location: str
    service_time: str
    purpose: str

class SubmissionStatusUpdate(BaseModel):
    status: SubmissionStatus

class SubmissionOut(BaseModel):
    submission_id: int
    interpreter_name: str
    request_date: date
    requestor_name: str
    affiliated_unit: str
    service_location: str
    service_time: str
    purpose: str
    status: SubmissionStatus
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True
