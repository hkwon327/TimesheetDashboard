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

def _safe_string(s: Optional[str], default: str = "") -> str:
    """NOT NULL 필드용 - 빈 값을 기본값으로 변환"""
    if not s or (isinstance(s, str) and not s.strip()):
        return default
    return s.strip()

def convert_to_date(date_str: Optional[str]):
    """문자열을 PostgreSQL DATE 타입으로 변환"""
    if not date_str:
        return None
    try:
        return datetime.strptime(date_str, "%m/%d/%Y").date()
    except ValueError:
        logger.warning("Invalid date format: %s", date_str)
        return None

def calculate_hours_from_range(time_range: Optional[str]) -> float:
    try:
        if not time_range or " - " not in str(time_range).replace("–", "-"):
            return 0.0
        # 엔대시 → 하이픈 정규화
        norm = str(time_range).replace("–", "-")
        start_s, end_s = norm.split(" - ")
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

def _safe_filename(base: str) -> str:
    """S3 객체 키로 쓰기 안전한 파일명으로 정리"""
    if not base:
        base = "employee"
    safe = "".join(c if c.isalnum() or c in ("-", "_") else "_" for c in base)
    return safe

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
        # 1) PDF 생성
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

        # 2) DB 연결
        conn = get_db_connection()
        cur = conn.cursor()

        # NOT NULL 제약조건 대응
        employee_name = _safe_string(form_data.employeeName, "Unknown Employee")
        requestor_name = _safe_string(form_data.requestorName, "Unknown Requestor")

        # 날짜 변환
        request_date = convert_to_date(form_data.requestDate)
        service_week_start = convert_to_date(form_data.serviceWeek.start if form_data.serviceWeek else None)
        service_week_end = convert_to_date(form_data.serviceWeek.end if form_data.serviceWeek else None)

        # 3) forms INSERT
        cur.execute("""
            INSERT INTO forms (
                employee_name, requestor_name, request_date,
                service_week_start, service_week_end,
                signature, is_submit, status, pdf_filename
            )
            VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s,'pending'),%s)
            RETURNING id
        """, (
            employee_name,
            requestor_name,
            request_date,
            service_week_start,
            service_week_end,
            _none_if_empty(form_data.signature) or "",
            bool(form_data.isSubmit),
            _none_if_empty(form_data.status),
            None  # pdf_filename은 아래에서 업데이트
        ))
        form_id = cur.fetchone()[0]
        logger.info("Form created with ID: %s", form_id)

        # 4) S3 업로드 및 파일명 업데이트
        filename = f"{_safe_filename(employee_name)}_{form_id}.pdf"
        prefix = (S3_PREFIX or "").strip().strip("/")
        key = f"{prefix}/{filename}" if prefix else filename

        s3 = get_s3_client()
        s3.put_object(Bucket=S3_BUCKET, Key=key, Body=pdf_bytes, ContentType="application/pdf")
        cur.execute("UPDATE forms SET pdf_filename=%s WHERE id=%s", (filename, form_id))
        logger.info("PDF uploaded: %s (key=%s)", filename, key)

        
        if form_data.schedule:
            logger.info("Processing %d schedule items for form %s", len(form_data.schedule), form_id)
            
            upsert_sql = """
                INSERT INTO form_schedule (form_id, day, "time", location)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (form_id, day) DO UPDATE
                SET "time" = EXCLUDED."time", location = EXCLUDED.location
            """
            
            schedule_count = 0
            for i, item in enumerate(form_data.schedule):
                try:
                    day_val = item.day.strip() if item.day and item.day.strip() else None
                    time_val_raw = item.time if item.time else None
                    # 엔대시(–) → 하이픈(-) 정규화
                    time_val = time_val_raw.replace("–", "-").strip() if time_val_raw and time_val_raw.strip() else None
                    location_val = item.location.strip() if item.location and item.location.strip() else None

                    logger.info("Schedule item %d: day='%s', time='%s', location='%s'", 
                              i, day_val, time_val, location_val)

                    # day가 없으면 UNIQUE 제약조건 때문에 스킵
                    if not day_val:
                        logger.warning("Skipping schedule item %d: no day specified", i)
                        continue

                    cur.execute(upsert_sql, (form_id, day_val, time_val, location_val))
                    schedule_count += 1
                    logger.info("Successfully processed schedule item %d", i)
                    
                except Exception as schedule_error:
                    logger.error("Error processing schedule item %d: %s", i, schedule_error)
                    logger.error("Item details: day=%s, time=%s, location=%s", 
                               getattr(item, 'day', 'N/A'), 
                               getattr(item, 'time', 'N/A'), 
                               getattr(item, 'location', 'N/A'))
                    continue
            
            logger.info("Successfully processed %d out of %d schedule items", schedule_count, len(form_data.schedule))
        else:
            logger.info("No schedule items to process")

        # 6) 커밋
        conn.commit()
        logger.info("Form %s and schedule saved successfully", form_id)
        return {"message": "Form saved", "form_id": form_id, "s3_filename": filename}

    except Exception as e:
        if conn:
            conn.rollback()
            logger.error("Transaction rolled back due to error")
        logger.exception("submit_form failed")
        raise HTTPException(status_code=500, detail=f"submit_form failed: {str(e)}")
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
            cur.execute('SELECT "time" FROM form_schedule WHERE form_id=%s', (f["id"],))
            f["total_hours"] = sum(
                calculate_hours_from_range(s["time"]) for s in cur.fetchall() if s["time"]
            )
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
        cur.execute('SELECT day, "time", location FROM form_schedule WHERE form_id=%s', (form_id,))
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
        key_candidate = unquote(pdf_filename).strip()
        prefix = (S3_PREFIX or "").strip().strip("/")
        key = f"{prefix}/{key_candidate}" if prefix else key_candidate

        s3.head_object(Bucket=S3_BUCKET, Key=key)

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