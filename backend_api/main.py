import os
import logging
from datetime import datetime
from urllib.parse import unquote
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Response, Request, Body, Path
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from botocore.exceptions import ClientError

from .models import FormData, PdfFormData
from .utils import get_s3_client, build_filled_pdf
from db.connection import get_db_connection  

# ------------------------------
# 환경 변수
# ------------------------------
S3_BUCKET = os.getenv("S3_BUCKET")
S3_PREFIX = os.getenv("S3_PREFIX")
PRESIGNED_EXPIRES = int(os.getenv("PRESIGNED_EXPIRES", "600"))

CORS_ORIGINS: List[str] = [
    o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()
]
# if not CORS_ORIGINS:
#     CORS_ORIGINS = ["*"]

# ------------------------------
# 로깅
# ------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s [%(name)s] %(message)s"
)
logger = logging.getLogger("bosk")

# ------------------------------
# FastAPI 앱
# ------------------------------
app = FastAPI(title="BOSK API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"],
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    body = await request.body()
    logger.info("➡️ %s %s | CT=%s | Body=%r",
                request.method, request.url.path,
                request.headers.get("content-type"),
                body[:200])
    resp = await call_next(request)
    logger.info("⬅️ %s %s %s", resp.status_code, request.method, request.url.path)
    return resp

# ------------------------------
# Health
# ------------------------------
@app.get("/")
def root():
    return {"message": "Server is running"}

@app.get("/db-health")
def db_health():
    conn, cur = None, None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT current_database();")
        return {"status": "DB is connected successfully", "db": cur.fetchone()[0]}
    except Exception as e:
        logger.error("DB health check failed: %s", e)
        raise HTTPException(status_code=500, detail="DB connection failed")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.get("/s3-health")
def s3_health():
    try:
        s3 = get_s3_client()
        buckets = [b["Name"] for b in s3.list_buckets().get("Buckets", [])]
        return {"status": "S3 is connected successfully", "buckets": buckets}
    except Exception as e:
        logger.exception("S3 health check failed")
        raise HTTPException(status_code=500, detail="S3 connection failed")

# ------------------------------
# Helpers
# ------------------------------
def _none_if_empty(s: Optional[str]) -> Optional[str]:
    if not s or (isinstance(s, str) and not s.strip()):
        return None
    return s

def calculate_hours_from_range(time_range: Optional[str]) -> float:
    try:
        if not time_range or " - " not in str(time_range):
            return 0.0
        start_s, end_s = str(time_range).split(" - ")
        start = datetime.strptime(start_s.strip(), "%I:%M %p")
        end = datetime.strptime(end_s.strip(), "%I:%M %p")
        start_min = start.hour * 60 + start.minute
        end_min = end.hour * 60 + end.minute
        if end_min <= start_min:
            end_min += 24 * 60
        return round((end_min - start_min) / 60.0, 2)
    except Exception as e:
        logger.warning("Time parsing error: %s (%s)", time_range, e)
        return 0.0

# ------------------------------
# Routes
# ------------------------------
@app.post("/generate-pdf")
def generate_pdf(form_data: PdfFormData):
    try:
        pdf_bytes = build_filled_pdf(form_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": "inline; filename=preview.pdf"}
        )
    except Exception as e:
        logger.exception("PDF generation failed")
        raise HTTPException(status_code=500, detail="PDF generation failed")

@app.post("/submit-form")
def submit_form(form_data: FormData):
    conn, cur = None, None
    try:
        pdf_data = PdfFormData(
            employeeName=form_data.employeeName or "",
            requestorName=form_data.requestorName or "",
            requestDate=form_data.requestDate or "",
            serviceWeek={
                "start": form_data.serviceWeek.start if form_data.serviceWeek else "",
                "end": form_data.serviceWeek.end if form_data.serviceWeek else "",
            },
            schedule=form_data.schedule or [],
            signature=form_data.signature or ""
        )
        pdf_bytes = build_filled_pdf(pdf_data)

        conn = get_db_connection()
        cur = conn.cursor()

        # INSERT form
        cur.execute("""
            INSERT INTO forms (
                employee_name, requestor_name, request_date,
                service_week_start, service_week_end,
                signature, is_submit, status, pdf_filename
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s,'pending'),%s)
            RETURNING id
        """, (
            _none_if_empty(form_data.employeeName),
            _none_if_empty(form_data.requestorName),
            form_data.requestDate,
            form_data.serviceWeek.start if form_data.serviceWeek else None,
            form_data.serviceWeek.end if form_data.serviceWeek else None,
            _none_if_empty(form_data.signature),
            bool(form_data.isSubmit),
            _none_if_empty(form_data.status),
            None
        ))
        form_id = cur.fetchone()[0]

        filename = f"{_none_if_empty(form_data.employeeName) or 'employee'}_{form_id}.pdf"
        key = f"{S3_PREFIX}/{filename}"

        s3 = get_s3_client()
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        cur.execute("UPDATE forms SET pdf_filename=%s WHERE id=%s", (filename, form_id))

        # schedule upsert
        upsert_sql = """
            INSERT INTO form_schedule (form_id, day, time, location)
            VALUES (%s,%s,%s,%s)
            ON CONFLICT (form_id, day) DO UPDATE
            SET time=EXCLUDED.time, location=EXCLUDED.location
        """
        for item in form_data.schedule:
            if not isinstance(item, dict):
                continue
            cur.execute(upsert_sql, (form_id, _none_if_empty(item.get("day")),
                                     _none_if_empty(item.get("time")),
                                     _none_if_empty(item.get("location"))))

        conn.commit()
        return {"message": "Form saved", "form_id": form_id, "s3_filename": filename}

    except Exception as e:
        if conn: conn.rollback()
        logger.exception("submit_form failed")
        raise HTTPException(status_code=500, detail="submit_form failed")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.get("/forms")
def get_forms():
    conn, cur = None, None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM forms ORDER BY created_at DESC")
        forms = cur.fetchall()
        for f in forms:
            cur.execute("SELECT time FROM form_schedule WHERE form_id=%s", (f["id"],))
            f["total_hours"] = sum(calculate_hours_from_range(s["time"]) for s in cur.fetchall() if s["time"])
        return {"forms": forms, "count": len(forms)}
    except Exception as e:
        logger.exception("get_forms failed")
        raise HTTPException(status_code=500, detail="DB error")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.get("/form/{form_id}")
def get_form(form_id: int = Path(..., ge=1)):
    conn, cur = None, None
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM forms WHERE id=%s", (form_id,))
        form = cur.fetchone()
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        cur.execute("SELECT day,time,location FROM form_schedule WHERE form_id=%s", (form_id,))
        schedule = cur.fetchall()
        form["total_hours"] = sum(calculate_hours_from_range(s["time"]) for s in schedule if s["time"])
        return {"form": form, "schedule": schedule}
    except Exception as e:
        logger.exception("get_form failed")
        raise HTTPException(status_code=500, detail="DB error")
    finally:
        if cur: cur.close()
        if conn: conn.close()

@app.get("/form-pdf-url/{pdf_filename}")
def get_pdf_presigned_url(pdf_filename: str):
    try:
        s3 = get_s3_client()
        key = f"{S3_PREFIX}/{unquote(pdf_filename).strip()}"
        s3.head_object(Bucket=S3_BUCKET, Key=key)  # 존재 확인
        url = s3.generate_presigned_url(
            "get_object",
            Params={"Bucket": S3_BUCKET, "Key": key},
            ExpiresIn=PRESIGNED_EXPIRES
        )
        return {"url": url, "expires_in": PRESIGNED_EXPIRES}
    except ClientError as e:
        logger.warning("File not found in S3: %s", e)
        raise HTTPException(status_code=404, detail="File not found")
    except Exception as e:
        logger.exception("presigned url failed")
        raise HTTPException(status_code=500, detail="URL generation failed")

@app.put("/form/{form_id}/status")
def update_status(form_id: int, new_status: str = Body(..., embed=True)):
    valid = {"pending", "approved", "deleted", "confirmed"}
    if new_status not in valid:
        raise HTTPException(status_code=400, detail="Invalid status")
    conn, cur = None, None
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE forms SET status=%s WHERE id=%s RETURNING id", (new_status, form_id))
        if not cur.fetchone():
            raise HTTPException(status_code=404, detail="Form not found")
        conn.commit()
        return {"message": f"Form {form_id} status updated to {new_status}"}
    except Exception as e:
        if conn: conn.rollback()
        logger.exception("update_status failed")
        raise HTTPException(status_code=500, detail="DB error")
    finally:
        if cur: cur.close()
        if conn: conn.close()
