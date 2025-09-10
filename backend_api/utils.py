import os
import io
import base64
import boto3
from fastapi import HTTPException
from PyPDF2 import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas

# ---- S3 client ----
_s3_client = boto3.client("s3")
def get_s3_client():
    return _s3_client

# ---- Template path (환경변수 없이 상대경로 고정) ----
HERE = os.path.dirname(os.path.abspath(__file__))
TEMPLATE_PDF = os.path.join(HERE, "templates", "Form.pdf")

def _has_text(v) -> bool:
    return isinstance(v, str) and v.strip() != ""

def build_filled_pdf(form_data) -> bytes:
    if not os.path.exists(TEMPLATE_PDF):
        raise HTTPException(
            status_code=404,
            detail=f"Template PDF not found at {TEMPLATE_PDF}"
        )

    template_pdf = PdfReader(TEMPLATE_PDF)

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

    # ===== 스케줄 =====
    schedule = getattr(form_data, "schedule", None) or []
    if schedule:
        first_loc = (
            getattr(schedule[0], "location", None)
            if hasattr(schedule[0], "location")
            else (schedule[0].get("location") if isinstance(schedule[0], dict) else None)
        )
        if _has_text(first_loc):
            can.drawString(215, y_top - 170, first_loc)

    service_week = getattr(form_data, "serviceWeek", {}) or {}
    if isinstance(service_week, dict):
        sw_start = (service_week.get("start") or "").strip()
        sw_end = (service_week.get("end") or "").strip()
    else:
        sw_start = sw_end = ""
    if sw_start or sw_end:
        can.drawString(210, y_top - 210, f"{sw_start} ~ {sw_end}")

    y = y_top - 270
    for item in schedule:
        if isinstance(item, dict):
            day = item.get("day", "") or ""
            time_ = item.get("time", "") or ""
            loc = item.get("location", "") or ""
        else:
            day = getattr(item, "day", "") or ""
            time_ = getattr(item, "time", "") or ""
            loc = getattr(item, "location", "") or ""

        if _has_text(time_) or _has_text(loc):
            if _has_text(day):
                can.drawString(150, y, day)
            if _has_text(time_):
                can.drawString(260, y, time_)
            if _has_text(loc):
                can.drawString(400, y, loc)
            y -= 30

    # ===== 하단 =====
    EMP_SIGN_NAME_X, EMP_SIGN_NAME_Y = 330, 230
    SIGN_IMG_X, SIGN_IMG_Y = 280, 165
    REQUESTOR_NAME_X, REQUESTOR_NAME_Y = 430, 190

    if _has_text(getattr(form_data, "employeeName", "")):
        can.drawString(EMP_SIGN_NAME_X, EMP_SIGN_NAME_Y, form_data.employeeName)

    sig_raw = getattr(form_data, "signature", None)
    if _has_text(sig_raw):
        try:
            sig_data = sig_raw.split(",")[1] if "," in sig_raw else sig_raw
            sig_bytes = base64.b64decode(sig_data)
            sig_image = io.BytesIO(sig_bytes)
            can.drawImage(ImageReader(sig_image), x=SIGN_IMG_X, y=SIGN_IMG_Y, width=150, height=50, mask="auto")
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid signature format")

    if _has_text(getattr(form_data, "requestorName", "")):
        can.drawString(REQUESTOR_NAME_X, REQUESTOR_NAME_Y, form_data.requestorName)

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
