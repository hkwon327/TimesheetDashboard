from typing import List, Dict, Optional
from pydantic import BaseModel, field_validator, model_validator, ConfigDict
from enum import Enum
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)

# ------------------------------
# 상태 Enum
# ------------------------------
class StatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    deleted = "deleted"
    confirmed = "confirmed"

# ------------------------------
# Schedule & Week Models
# ------------------------------
class ScheduleItem(BaseModel):
    day: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None

class ServiceWeek(BaseModel):
    start: Optional[str] = None     
    end: Optional[str] = None

# ------------------------------
# PDF 전용 모델
# ------------------------------
class PdfFormData(BaseModel):
    employeeName: str = ""
    requestorName: str = ""
    requestDate: str = ""
    serviceWeek: Dict[str, str] = {}
    schedule: List[ScheduleItem] = []
    signature: str = ""

# ------------------------------
# 유틸 함수
# ------------------------------
def convert_date_format(date_str: Optional[str]) -> Optional[str]:
    if not date_str or not isinstance(date_str, str) or not date_str.strip():
        return None

    #  MM/DD/YYYY
    if len(date_str.split("/")) == 2:
        current_year = datetime.now().year
        date_str = f"{date_str}/{current_year}"

    formats = ["%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%Y/%m/%d"]
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime("%m/%d/%Y")
        except ValueError:
            continue

    logger.warning("Invalid date format: %s", date_str)
    return None

def calculate_end_date(start_date_str: str) -> Optional[str]:
    try:
        start_date = datetime.strptime(start_date_str, "%m/%d/%Y")
        end_date = start_date + timedelta(days=4)
        return end_date.strftime("%m/%d/%Y")
    except ValueError:
        logger.warning("End date calculation failed: %s", start_date_str)
        return None

# ------------------------------
# FormData (주요 입력 모델)
# ------------------------------
class FormData(BaseModel):
    id: Optional[int] = None
    employeeName: Optional[str] = None
    requestorName: Optional[str] = None
    requestDate: Optional[str] = None
    serviceWeek: Optional[ServiceWeek] = None
    signature: Optional[str] = None
    isSubmit: Optional[bool] = False
    status: Optional[str] = "pending"
    schedule: List[ScheduleItem] = []

    @field_validator("requestDate", mode="before")
    @classmethod
    def validate_request_date(cls, v):
        return convert_date_format(v)

    @model_validator(mode="before")
    @classmethod
    def normalize_service_week_and_schedule(cls, values):
        if not isinstance(values, dict):
            return values

        # serviceWeek 정규화
        service_week = values.get("serviceWeek")
        if isinstance(service_week, dict) and service_week.get("start"):
            start_fmt = convert_date_format(service_week["start"])
            if start_fmt:
                service_week["start"] = start_fmt
                if not service_week.get("end"):
                    service_week["end"] = calculate_end_date(start_fmt)
                else:
                    end_fmt = convert_date_format(service_week["end"])
                    if end_fmt:
                        service_week["end"] = end_fmt

        # schedule 정규화
        if isinstance(values.get("schedule"), list):
            new_schedule = []
            for item in values["schedule"]:
                if not isinstance(item, dict):
                    continue
                schedule_item = {
                    "day": item.get("day"),
                    "time": item.get("time"),
                    "location": item.get("location"),
                }
                if item.get("date"):
                    date_fmt = convert_date_format(item["date"])
                    if date_fmt:
                        try:
                            date_obj = datetime.strptime(date_fmt, "%m/%d/%Y")
                            day_name = (item.get("day") or "").split("/")[-1]
                            schedule_item["day"] = f"{date_obj.strftime('%m/%d')}/{day_name}"
                        except Exception:
                            pass
                new_schedule.append(schedule_item)
            values["schedule"] = new_schedule

        return values

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "employeeName": "John Doe",
                "requestorName": "Jane Smith",
                "requestDate": "03/20/2024",
                "serviceWeek": {
                    "start": "03/20/2024",
                    "end": "03/24/2024",
                },
                "schedule": [
                    {
                        "day": "03/20/Monday",
                        "time": "8:00 AM - 5:00 PM",
                        "location": "BOSK Trailer",
                    }
                ],
                "signature": "data:image/png;base64,...",
                "isSubmit": True,
                "status": "pending",
            }
        }
    )
