import boto3

from PyPDF2 import PdfReader, PdfWriter
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
import base64
import io
import os
from fastapi import HTTPException

# 전역 S3 클라이언트 인스턴스 (한 번만 생성)
_s3_client = boto3.client('s3')

def get_s3_client():
    """
    전역 S3 클라이언트를 반환합니다.
    테스트/모킹 또는 여러 모듈에서 재사용 가능하게 함.
    """
    return _s3_client


def build_filled_pdf(template_path: str, form_data) -> bytes:
    if not os.path.exists(template_path):
        raise HTTPException(status_code=404, detail="Template PDF not found")

    template_pdf = PdfReader(template_path)
    packet = io.BytesIO()
    can = canvas.Canvas(packet, pagesize=letter)
    can.setFont("Helvetica", 10)

    y = 710
    can.drawString(440, y, form_data.requestDate)
    can.drawString(440, y - 32, form_data.requestorName)
    can.drawString(215, y - 135, form_data.employeeName)

    if form_data.schedule:
        can.drawString(215, y - 170, form_data.schedule[0].location)

    service_week = form_data.serviceWeek
    can.drawString(210, y - 210, f"{service_week['start']} ~ {service_week['end']}")

    y -= 270
    for item in form_data.schedule:
        can.drawString(150, y, item.day)
        can.drawString(260, y, item.time)
        can.drawString(400, y, item.location)
        y -= 30


    can.drawString(320, y - 60, form_data.employeeName)

    # Signature 처리
    if form_data.signature:
        try:
            sig_data = form_data.signature.split(',')[1] if ',' in form_data.signature else form_data.signature
            sig_bytes = base64.b64decode(sig_data)
            sig_image = io.BytesIO(sig_bytes)
            can.drawImage(ImageReader(sig_image), x=320, y=170, width=150, height=50, mask='auto')
        except Exception as e:
            raise HTTPException(status_code=400, detail="Invalid signature format")

    can.save()
    packet.seek(0)

    new_pdf = PdfReader(packet)
    output = PdfWriter()
    page = template_pdf.pages[0]
    page.merge_page(new_pdf.pages[0])
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
