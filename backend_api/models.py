from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field, field_validator, model_validator
from enum import Enum
from datetime import datetime, timedelta

# 상태 Enum
class StatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    deleted = "deleted"
    confirmed = "confirmed"

class ScheduleItem(BaseModel):
    day: Optional[str] = None
    time: Optional[str] = None       
    location: Optional[str] = None

class ServiceWeek(BaseModel):
    start: Optional[str] = None      # "MM/DD/YYYY" 문자열 (서버에서 필요 시 파싱)
    end: Optional[str] = None

# Pdf용 출력 모델 (FormData에서 id, isSubmit, status 제외)
class PdfFormData(BaseModel):
    employeeName: str = ""
    requestorName: str = ""
    requestDate: str = ""
    serviceWeek: Dict[str, str] = {}
    schedule: List[ScheduleItem] = []
    signature: str = ""

# 날짜 포맷 정규화 함수
def convert_date_format(date_str: Optional[str]) -> Optional[str]:
    if not date_str or not isinstance(date_str, str):
        return date_str
        
    # 빈 문자열 처리
    if date_str.strip() == "":
        return date_str
    
    # MM/DD 형태를 MM/DD/YYYY로 변환
    if date_str and len(date_str.split('/')) == 2:
        current_year = datetime.now().year
        date_str = f"{date_str}/{current_year}"

    formats = ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%Y/%m/%d']
    for fmt in formats:
        try:
            return datetime.strptime(date_str, fmt).strftime('%m/%d/%Y')
        except ValueError:
            continue
    return date_str

# end 날짜 자동 생성 함수 (start 기준 4일 뒤)
def calculate_end_date(start_date_str: str) -> str:
    try:
        start_date = datetime.strptime(start_date_str, '%m/%d/%Y')
        end_date = start_date + timedelta(days=4)
        return end_date.strftime('%m/%d/%Y')
    except ValueError:
        return start_date_str

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

    @field_validator('requestDate', mode='before')
    @classmethod
    def validate_request_date(cls, v):
        if v is None or v == "":
            return v
        return convert_date_format(v)

    @model_validator(mode='before')
    @classmethod
    def process_service_week_and_schedule(cls, values):
        if not isinstance(values, dict):
            return values

        # serviceWeek 처리
        if "serviceWeek" in values and values["serviceWeek"]:
            service_week = values["serviceWeek"]
            if isinstance(service_week, dict):
                start = service_week.get("start")
                end = service_week.get("end")

                if start:
                    start_fmt = convert_date_format(start)
                    if start_fmt:
                        service_week["start"] = start_fmt
                        
                        # end가 없으면 start 기준으로 계산
                        if not end or end.strip() == "":
                            service_week["end"] = calculate_end_date(start_fmt)
                        else:
                            end_fmt = convert_date_format(end)
                            if end_fmt:
                                service_week["end"] = end_fmt

        # schedule 처리 - 더 안전하게
        if "schedule" in values and isinstance(values["schedule"], list):
            new_schedule = []
            for item in values["schedule"]:
                if not isinstance(item, dict):
                    continue
                
                # 기본 필드들 복사
                schedule_item = {
                    "day": item.get("day"),
                    "time": item.get("time"),
                    "location": item.get("location")
                }
                
                # date 필드가 있으면 day 필드로 포맷팅
                if "date" in item and item["date"]:
                    date_str = convert_date_format(item["date"])
                    if date_str:
                        try:
                            date_obj = datetime.strptime(date_str, "%m/%d/%Y")
                            day_name = item.get("day", "")
                            
                            # day_name에서 요일 부분만 추출
                            if '/' in str(day_name):
                                day_name = day_name.split('/')[-1]
                            
                            # MM/DD/DayName 형태로 포맷
                            formatted_day = f"{date_obj.strftime('%m/%d')}/{day_name}"
                            schedule_item["day"] = formatted_day
                        except (ValueError, AttributeError):
                            # 파싱 실패시 원본 day 값 유지
                            pass
                
                new_schedule.append(schedule_item)
            
            values["schedule"] = new_schedule

        return values

    class Config:
        # Pydantic v2 호환성을 위한 설정
        json_schema_extra = {
            "example": {
                "employeeName": "John Doe",
                "requestorName": "Jane Smith",
                "requestDate": "03/20/2024",
                "serviceWeek": {
                    "start": "03/20/2024",
                    "end": "03/24/2024"
                },
                "schedule": [
                    {
                        "day": "03/20/Monday",
                        "time": "8:00 AM - 5:00 PM",
                        "location": "BOSK Trailer"
                    }
                ],
                "signature": "data:image/png;base64,...",
                "isSubmit": True,
                "status": "pending"
            }
        }