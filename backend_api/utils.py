import base64
import io
import os

import boto3
from fastapi import HTTPException
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# 전역 S3 클라이언트 인스턴스 (한 번만 생성)
_s3_client = boto3.client('s3')


def get_s3_client():
    """
    전역 S3 클라이언트를 반환합니다.
    테스트/모킹 또는 여러 모듈에서 재사용 가능하게 함.
    """
    return _s3_client


def _has_text(v) -> bool:
    """문자열이 공백이 아닌 텍스트인지 확인"""
    return isinstance(v, str) and v.strip() != ""


def build_filled_pdf(template_path: str, form_data) -> bytes:
    """
    주어진 템플릿 PDF에 form_data 내용을 채워서 바이트로 반환.
    - 빈 값(혹은 공백만 있는 값)은 출력하지 않음
    - serviceWeek는 start/end 둘 중 하나라도 있으면 'start ~ end' 형식으로 출력
    - schedule의 각 행은 **time/location 중 하나라도** 값이 있을 때만 그 행을 출력
      (그때 day도 함께 출력)
    """
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template PDF not found")

    # 템플릿 PDF 읽기
    template_pdf = PdfReader(template_path)

    # 그리기용 버퍼/캔버스 준비
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.setFont("Helvetica", 10)

    # ===== 상단 필드 =====
    y_top = 710

    if _has_text(getattr(form_data, "requestDate", "")):
        can.drawString(440, y_top, form_data.requestDate)

    if _has_text(getattr(form_data, "requestorName", "")):
        can.drawString(440, y_top - 32, form_data.requestorName)

    if _has_text(getattr(form_data, "employeeName", "")):
        can.drawString(215, y_top - 135, form_data.employeeName)

    # 첫 스케줄 위치(옵션)
    schedule = getattr(form_data, "schedule", None) or []
    if schedule:
        first_loc = getattr(schedule[0], "location", None)
        if _has_text(first_loc):
            can.drawString(215, y_top - 170, first_loc)

    # 서비스 주간
    service_week = getattr(form_data, "serviceWeek", {}) or {}
    sw_start = (service_week.get("start") or "").strip() if isinstance(service_week, dict) else ""
    sw_end = (service_week.get("end") or "").strip() if isinstance(service_week, dict) else ""
    if sw_start or sw_end:
        can.drawString(210, y_top - 210, f"{sw_start} ~ {sw_end}")

    # ===== 스케줄 표 =====
    y = y_top - 270
    for item in schedule:
        day = getattr(item, "day", "") or ""
        time_ = getattr(item, "time", "") or ""
        loc = getattr(item, "location", "") or ""

        # ✅ 시간 또는 장소가 있을 때만 그 줄을 출력 (요일 단독 출력 방지)
        if _has_text(time_) or _has_text(loc):
            if _has_text(day):
                can.drawString(150, y, day)
            if _has_text(time_):
                can.drawString(260, y, time_)
            if _has_text(loc):
                can.drawString(400, y, loc)
            y -= 30  # 실제 출력한 행에만 줄바꿈


    # ===== 하단 고정 영역 =====
    EMP_SIGN_NAME_X, EMP_SIGN_NAME_Y = 330, 230   
    SIGN_IMG_X, SIGN_IMG_Y = 280, 165            
    REQUESTOR_NAME_X, REQUESTOR_NAME_Y = 430, 190 

    # 하단 사인 이름(고정 좌표)
    if _has_text(getattr(form_data, "employeeName", "")):
        can.drawString(EMP_SIGN_NAME_X, EMP_SIGN_NAME_Y, form_data.employeeName)

    # 서명 이미지(고정 좌표)
    sig_raw = getattr(form_data, "signature", None)
    if _has_text(sig_raw):
        try:
            sig_data = sig_raw.split(",")[1] if "," in sig_raw else sig_raw
            sig_bytes = base64.b64decode(sig_data)
            sig_image = io.BytesIO(sig_bytes)
            can.drawImage(
                ImageReader(sig_image),
                x=SIGN_IMG_X,
                y=SIGN_IMG_Y,
                width=150,
                height=50,
                mask="auto",
            )
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature format")

    # 요청자 이름(고정 좌표)
    if _has_text(getattr(form_data, "requestorName", "")):
        can.drawString(REQUESTOR_NAME_X, REQUESTOR_NAME_Y, form_data.requestorName)  

    # 캔버스 종료 및 병합
    can.save()
    packet.seek(0)

    new_pdf = PdfReader(packet)
    output = PdfWriter()
    page = template_pdf.pages[0]
    page.merge_page(new_pdf.pages[0])  # 오버레이
    output.add_page(page)

    final_output = io.BytesIO()
    output.write(final_output)
    return final_output.getvalue()













########################################################################################
from datetime import datetime


def convert_date_format(date_str: str) -> str:
    """
    다양한 날짜 형식을 MM/DD/YYYY 형식으로 변환하는 유틸 함수
    예: '2024-03-20' -> '03/20/2024'
    """
    if date_str and len(date_str.split('/')) == 2:
        current_year = datetime.now().year
        date_str = f"{date_str}/{current_year}"

    date_formats = [
        '%m/%d/%Y',
        '%m-%d-%Y',
        '%Y-%m-%d',
        '%Y/%m/%d'
    ]

    for fmt in date_formats:
        try:
            date_obj = datetime.strptime(date_str, fmt)
            return date_obj.strftime('%m/%d/%Y')
        except ValueError:
            continue

    return date_str


from typing import Optional
import datetime

def parse_date(date_str: str) -> Optional[datetime.date]:
    """
    문자열 날짜를 datetime.date 객체로 파싱 (DB 삽입용)
    지원 포맷: MM/DD/YYYY 또는 YYYY-MM-DD
    """
    if not date_str:
        return None

    try:
        if '/' in date_str:
            return datetime.strptime(date_str, '%m/%d/%Y').date()
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None


# utils.py

import io
import base64
from datetime import datetime
from typing import Union
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from PyPDF2 import PdfReader, PdfWriter
import boto3


from backend_api.models import FormData, PdfFormData



def convert_date_format(date_str: str) -> str:
    if date_str and len(date_str.split('/')) == 2:
        current_year = datetime.now().year
        date_str = f"{date_str}/{current_year}"

    for fmt in ['%m/%d/%Y', '%m-%d-%Y', '%Y-%m-%d', '%Y/%m/%d']:
        try:
            return datetime.strptime(date_str, fmt).strftime('%m/%d/%Y')
        except ValueError:
            continue
    return date_str


def parse_date(date_str: str):
    if not date_str:
        return None
    try:
        if '/' in date_str:
            return datetime.strptime(date_str, '%m/%d/%Y').date()
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except ValueError:
        return None



def upload_pdf_to_s3(form_data: FormData, pdf_bytes: bytes) -> str:
    s3 = boto3.client('s3')
    filename = f"{form_data.employeeName}_{form_data.id}.pdf"
    path = f"work-hours-forms/{filename}"

    s3.put_object(
        Bucket='bosk-pdf',
        Key=path,
        Body=pdf_bytes,
        ContentType='application/pdf'
    )

    return f"https://bosk-pdf.s3.amazonaws.com/{path}"
