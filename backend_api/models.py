from typing import List, Dict, Optional
from pydantic import BaseModel, Field, root_validator
from enum import Enum
from datetime import datetime, timedelta

# 상태 Enum
class StatusEnum(str, Enum):
    pending = "pending"
    approved = "approved"
    deleted = "deleted"
    confirmed = "confirmed"


# 개별 스케줄 항목
class ScheduleItem(BaseModel):
    day: str  # 포맷: MM/DD/요일
    time: str
    location: str

# Pdf용 출력 모델 (간단히 말해 FormData에서 id, isSubmit, status 제외)
class PdfFormData(BaseModel):
    employeeName: str
    requestorName: str
    requestDate: str
    serviceWeek: Dict[str, str]
    schedule: List[ScheduleItem]
    signature: str


# 날짜 포맷 정규화 함수
def convert_date_format(date_str: str) -> str:
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
    start_date = datetime.strptime(start_date_str, '%m/%d/%Y')
    end_date = start_date + timedelta(days=4)
    return end_date.strftime('%m/%d/%Y')

# 메인 입력 모델
class FormData(BaseModel):
    id: Optional[str] = None  # 유저 입력 X, 서버에서 UUID로 생성
    employeeName: str = Field(..., min_length=1)
    requestorName: str = Field(..., min_length=1)
    requestDate: str = Field(..., min_length=1)
    serviceWeek: Dict[str, str] = Field(...)
    schedule: List[ScheduleItem] = Field(..., min_items=1)
    signature: str = Field(..., min_length=1)
    isSubmit: Optional[bool] = True
    status: StatusEnum = StatusEnum.pending

    @root_validator(pre=True)
    def process_dates_and_service_week(cls, values):
        # requestDate 포맷 통일
        if "requestDate" in values:
            values["requestDate"] = convert_date_format(values["requestDate"])

        # serviceWeek 처리
        if "serviceWeek" in values and isinstance(values["serviceWeek"], dict):
            start = values["serviceWeek"].get("start")
            end = values["serviceWeek"].get("end")

            if not start:
                raise ValueError("'serviceWeek.start' is required.")

            start_fmt = convert_date_format(start)
            end_fmt = convert_date_format(end) if end else calculate_end_date(start_fmt)

            values["serviceWeek"]["start"] = start_fmt
            values["serviceWeek"]["end"] = end_fmt

        # schedule의 day/date 포맷 처리
        if "schedule" in values:
            new_schedule = []
            for item in values["schedule"]:
                date_str = convert_date_format(item.get("date", ""))
                try:
                    date_obj = datetime.strptime(date_str, "%m/%d/%Y")
                    day_name = item.get("day", "")
                    formatted_day = f"{date_obj.strftime('%m/%d')}/{day_name.split('/')[-1] if '/' in day_name else day_name}"
                    new_schedule.append({
                        "day": formatted_day,
                        "time": item["time"],
                        "location": item["location"]
                    })
                except Exception:
                    continue
            values["schedule"] = new_schedule

        return values

    class Config:
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



########################################################################################



# class StatusEnum(str, Enum):
#     pending = "pending"
#     approved = "approved"
#     deleted = "deleted"
#     confirmed = "confirmed"


# class ScheduleItem(BaseModel):
#     day: str
#     time: str
#     location: str


# class ServiceWeek(BaseModel):
#     start: str
#     end: str


# class FormIdsRequest(BaseModel):
#     form_ids: List[str]


# class FormData(BaseModel):
#     id: Optional[str] = None  # ✅ 선택 필드로 변경
#     employeeName: str = Field(..., min_length=1)
#     requestorName: str = Field(..., min_length=1)
#     requestDate: str
#     serviceWeek: Dict[str, str]
#     schedule: List[Dict[str, str]]
#     signature: Optional[str] = None
#     isSubmit: Optional[bool] = False


# class FormData(BaseModel):
#     id: Optional[str] = None  # 서버에서 UUID로 생성
#     employeeName: str = Field(..., min_length=1)
#     requestorName: str = Field(..., min_length=1)
#     requestDate: str
#     serviceWeek: Dict[str, str]
#     schedule: List[ScheduleItem]
#     signature: Optional[str] = None
#     isSubmit: Optional[bool] = False
#     status: StatusEnum = StatusEnum.pending  # 기본값 "pending"

#     class Config:
#         json_schema_extra = {
#             "example": {
#                 "employeeName": "John Doe",
#                 "requestorName": "Jane Smith",
#                 "requestDate": "03/20/2024",
#                 "serviceWeek": {
#                     "start": "03/20/2024",
#                     "end": "03/24/2024"
#                 },
#                 "schedule": [
#                     {
#                         "day": "03/20/Monday",
#                         "date": "03/20/2024",
#                         "time": "8:00 AM - 5:00 PM",
#                         "location": "BOSK Trailer"
#                     }
#                 ],
#                 "signature": "data:image/png;base64,...",
#                 "isSubmit": True
#             }
#         }


#     class Config:
#         json_schema_extra = {
#             "example": {
#                 "employeeName": "John Doe",
#                 "requestorName": "Jane Smith",
#                 "requestDate": "03/20/2024",
#                 "serviceWeek": {
#                     "start": "03/20/2024",
#                     "end": "03/24/2024"
#                 },
#                 "schedule": [
#                     {
#                         "day": "03/20/Monday",
#                         "time": "8:00 AM - 5:00 PM",
#                         "location": "BOSK Trailer"
#                     }
#                 ],
#                 "signature": "data:image/png;base64,...",
#                 "isSubmit": True
#             }
#         }


#     def format_schedule_days(self):
#         """날짜 형식을 MM/DD/DAY 로 변환"""
#         for item in self.schedule:
#             if 'date' in item and 'day' in item:
#                 try:
#                     date_str = convert_date_format(item['date'])
#                     date_obj = datetime.strptime(date_str, '%m/%d/%Y')
#                     item['day'] = f"{date_obj.strftime('%m/%d')}/{item['day'].split('/')[-1] if '/' in item['day'] else item['day']}"
#                     item['date'] = date_str
#                 except ValueError:
#                     continue

#         if isinstance(self.serviceWeek, dict):
#             if 'start' in self.serviceWeek:
#                 self.serviceWeek['start'] = convert_date_format(self.serviceWeek['start'])
#             if 'end' in self.serviceWeek:
#                 self.serviceWeek['end'] = convert_date_format(self.serviceWeek['end'])

#         if self.requestDate:
#             self.requestDate = convert_date_format(self.requestDate)

#     def __init__(self, **data):
#         super().__init__(**data)
#         self.format_schedule_days()



# # 날짜 형식 변환 유틸 함수
# def convert_date_format(date_str: str) -> str:
#     """다양한 날짜 형식을 MM/DD/YYYY 로 변환"""
#     if date_str and len(date_str.split('/')) == 2:
#         current_year = datetime.now().year
#         date_str = f"{date_str}/{current_year}"

#     formats = ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%Y/%m/%d']
#     for fmt in formats:
#         try:
#             return datetime.strptime(date_str, fmt).strftime('%m/%d/%Y')
#         except ValueError:
#             continue
#     return date_str
