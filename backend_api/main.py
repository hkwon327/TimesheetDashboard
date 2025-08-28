from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from psycopg2.extras import RealDictCursor
from fastapi import APIRouter, Body
from backend_api.models import FormData, PdfFormData
from botocore.exceptions import ClientError
from backend_api.utils import get_s3_client, build_filled_pdf
from db.connection import get_db_connection
from datetime import datetime
from psycopg2.extras import Json
from urllib.parse import unquote
import logging
from psycopg2 import errors
from fastapi import HTTPException, Request

# FastAPI 앱 초기화
app = FastAPI()

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)

@app.middleware("http")
async def log_requests(request: Request, call_next):
    body = await request.body()
    print(f"➡️ {request.method} {request.url.path}  Content-Type={request.headers.get('content-type')}  Body={body[:200]!r}")
    resp = await call_next(request)
    print(f"⬅️ {resp.status_code} {request.method} {request.url.path}")
    return resp

# 루트 헬스체크
@app.get("/")
async def root():
    print("Server is running")
    return {"message": "Server is running"}

# Local DB 연결 테스트
@app.get("/db-health")
def check_db_connection():
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 현재 연결된 DB 이름 조회
        cur.execute("SELECT current_database();")
        db_name = cur.fetchone()[0]

        cur.close()
        conn.close()

        return {"status": "DB connected successfully", "db_name": db_name}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB connection failed: {str(e)}")

# S3 연결 테스트
@app.get("/test-s3-connection")
async def test_s3():
    try:
        print("Testing S3 connection...")
        s3_client = get_s3_client()

        print("Getting bucket list...")
        response = s3_client.list_buckets()
        buckets = [bucket['Name'] for bucket in response['Buckets']]
        
        print(f"Found buckets: {buckets}")
        return {
            "message": "S3 connection successful",
            "buckets": buckets
        }
    except Exception as e:
        print(f"Error testing S3 connection: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# generate preview
@app.post("/generate-pdf")
async def generate_pdf(form_data: PdfFormData):
    try:
        template_path = "/Users/haeun/Desktop/BOSK/submission-app/public/assets/Form.pdf"  # local path
        # template_path = "/home/ubuntu/Form.pdf"  # EC2 path
        pdf_bytes = build_filled_pdf(template_path, form_data)
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=preview.pdf",
                "Access-Control-Allow-Origin": "*"
            }
        )
    except Exception as e:
        logger.error(f"PDF generation error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"PDF generation failed: {str(e)}")


# 유틸: 빈 문자열 → None
def _none_if_empty(s):
    if s is None:
        return None
    if isinstance(s, str) and s.strip() == "":
        return None
    return s

@app.post("/submit-form")
async def submit_form(form_data: FormData):  # ✅ 타입 힌트 추가
    try:
        logger.info(f"Received form data: {form_data}")
        
        s3_client = get_s3_client()

        # 1) PDF 생성을 위한 PdfFormData 객체 생성
        pdf_form_data = PdfFormData(
            employeeName=form_data.employeeName or "",
            requestorName=form_data.requestorName or "",
            requestDate=form_data.requestDate or "",
            serviceWeek={
                "start": form_data.serviceWeek.start if form_data.serviceWeek else "",
                "end": form_data.serviceWeek.end if form_data.serviceWeek else ""
            },
            schedule=form_data.schedule or [],
            signature=form_data.signature or ""
        )
        
        template_path = "/Users/haeun/Desktop/BOSK/submission-app/public/assets/Form.pdf"
        pdf_bytes = build_filled_pdf(template_path, pdf_form_data)

        # 2) DB 연결
        conn = get_db_connection()
        cur = conn.cursor()

        # 날짜들 (빈값이면 None)
        request_date = None
        if _none_if_empty(form_data.requestDate):
            try:
                request_date = datetime.strptime(form_data.requestDate, "%m/%d/%Y").date()
            except ValueError as e:
                logger.error(f"Date parsing error for requestDate: {form_data.requestDate}, error: {e}")

        sw_start = sw_end = None
        if form_data.serviceWeek:
            if _none_if_empty(form_data.serviceWeek.start):
                try:
                    sw_start = datetime.strptime(form_data.serviceWeek.start, "%m/%d/%Y").date()
                except ValueError as e:
                    logger.error(f"Date parsing error for serviceWeek.start: {form_data.serviceWeek.start}, error: {e}")
            if _none_if_empty(form_data.serviceWeek.end):
                try:
                    sw_end = datetime.strptime(form_data.serviceWeek.end, "%m/%d/%Y").date()
                except ValueError as e:
                    logger.error(f"Date parsing error for serviceWeek.end: {form_data.serviceWeek.end}, error: {e}")

        # forms INSERT (id는 SERIAL)
        cur.execute("""
            INSERT INTO forms (
                employee_name,
                requestor_name,
                request_date,
                service_week_start,
                service_week_end,
                signature,
                is_submit,
                status,
                pdf_filename
            ) VALUES (%s,%s,%s,%s,%s,%s,%s,COALESCE(%s,'pending'),%s)
            RETURNING id
        """, (
            _none_if_empty(form_data.employeeName),
            _none_if_empty(form_data.requestorName),
            request_date,
            sw_start,
            sw_end,
            _none_if_empty(form_data.signature),
            bool(form_data.isSubmit),
            _none_if_empty(form_data.status),
            None
        ))

        form_id = cur.fetchone()[0]

        # 파일명
        safe_emp = _none_if_empty(form_data.employeeName) or "employee"
        filename = f"{safe_emp}_{form_id}.pdf"

        # 3) S3 업로드
        s3_client.put_object(
            Bucket="bosk-pdf",
            Key=f"work-hours-forms/{filename}",
            Body=pdf_bytes,
            ContentType="application/pdf"
        )

        # pdf_filename 업데이트
        cur.execute("UPDATE forms SET pdf_filename=%s WHERE id=%s", (filename, form_id))

        # 4) 스케줄 저장 (TEXT 그대로)
        upsert_sql = """
            INSERT INTO form_schedule (form_id, day, time, location)
            VALUES (%s,%s,%s,%s)
            ON CONFLICT (form_id, day)
            DO UPDATE SET
              time=EXCLUDED.time,
              location=EXCLUDED.location
        """
        
        for item in form_data.schedule:
            day = _none_if_empty(item.day)
            time_val = _none_if_empty(item.time)   # 문자열 그대로
            location = _none_if_empty(item.location)

            if not (time_val or location):
                continue
            if not day:
                logger.warning("Schedule item missing 'day', skipping")
                continue

            cur.execute(upsert_sql, (form_id, day, time_val, location))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Form saved to S3 and DB",
            "form_id": form_id,
            "s3_filename": filename,
            "pdf_url": f"https://bosk-pdf.s3.amazonaws.com/work-hours-forms/{filename}"
        }

    except ClientError as e:
        logger.error(f"S3 error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        import traceback
        logger.error(f"submit_form error: {str(e)}")
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))



from fastapi import HTTPException
from psycopg2.extras import RealDictCursor
from datetime import datetime
from urllib.parse import unquote

def calculate_hours_from_range(time_range):
    """시간 범위 문자열에서 시간 계산"""
    try:
        if not time_range or ' - ' not in str(time_range):
            return 0
            
        start_time_str, end_time_str = str(time_range).split(' - ')
        
        # 시간을 24시간 형식으로 변환
        start_time = datetime.strptime(start_time_str.strip(), '%I:%M %p')
        end_time = datetime.strptime(end_time_str.strip(), '%I:%M %p')
        
        start_hour = start_time.hour
        start_minute = start_time.minute
        end_hour = end_time.hour
        end_minute = end_time.minute
        
        # 분 단위로 변환
        start_minutes = start_hour * 60 + start_minute
        end_minutes = end_hour * 60 + end_minute
        
        # 자정을 넘어가는 경우 처리
        if end_minutes <= start_minutes:
            end_minutes += 24 * 60  # 다음날로 계산
        
        # 시간 차이 계산
        diff_minutes = end_minutes - start_minutes
        hours = diff_minutes / 60
        
        return hours
        
    except Exception as e:
        logger.error(f"Time parsing error: {e}, time_range: {time_range}")
        return 0

@app.get("/forms")
async def get_forms():
    """모든 폼 목록을 가져오고 각각의 총 근무시간을 계산"""
    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # forms 데이터 가져오기
        cur.execute("""
            SELECT 
                id,
                employee_name,
                requestor_name,
                request_date,
                service_week_start,
                service_week_end,
                is_submit,
                status,
                created_at,  -- created_date, created_time 대신 created_at 사용
                pdf_filename
            FROM forms 
            ORDER BY created_at DESC;
        """)
        forms = cur.fetchall()
        
        # 각 form에 대해 total_hours 계산
        for form in forms:
            cur.execute("""
                SELECT time 
                FROM form_schedule 
                WHERE form_id = %s
            """, (form['id'],))
            schedules = cur.fetchall()
            
            total_hours = 0
            for schedule in schedules:
                if schedule['time']:  # time이 None이 아닌 경우만 계산
                    hours = calculate_hours_from_range(schedule['time'])
                    total_hours += hours
            
            form['total_hours'] = round(total_hours, 2)
        
        return {"forms": forms, "count": len(forms)}
        
    except Exception as e:
        logger.error(f"Error in get_forms: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.get("/form/{form_id}")
async def get_form_with_schedule(form_id: int):  # str에서 int로 변경
    """특정 폼의 상세 정보와 스케줄을 가져오기"""
    conn = None
    cur = None
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 폼 정보 가져오기
        cur.execute("SELECT * FROM forms WHERE id = %s", (form_id,))
        form = cur.fetchone()
        
        if not form:
            raise HTTPException(status_code=404, detail="Form not found")
        
        # 스케줄 정보 가져오기
        cur.execute("""
            SELECT day, time, location 
            FROM form_schedule 
            WHERE form_id = %s 
            ORDER BY day
        """, (form_id,))
        schedule = cur.fetchall()
        
        # 총 근무시간 계산
        total_hours = 0
        for item in schedule:
            if item['time']:
                hours = calculate_hours_from_range(item['time'])
                total_hours += hours
        
        return {
            "form": form,
            "schedule": schedule,
            "total_hours": round(total_hours, 2)
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_form_with_schedule: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
    
    finally:
        if cur:
            cur.close()
        if conn:
            conn.close()

@app.get("/form-pdf-url/{pdf_filename}")
async def get_pdf_presigned_url(pdf_filename: str):
    """PDF 파일의 presigned URL 생성"""
    try:
        s3_client = get_s3_client()
        
        # 파일명 디코딩 및 정리
        decoded_filename = unquote(pdf_filename).strip()
        key = f"work-hours-forms/{decoded_filename}"
        
        logger.info(f"Generating presigned URL for key: {key}")
        
        # S3에서 파일 존재 여부 확인 (선택사항)
        try:
            s3_client.head_object(Bucket="bosk-pdf", Key=key)
        except s3_client.exceptions.NoSuchKey:
            raise HTTPException(status_code=404, detail="PDF file not found in S3")
        except Exception as e:
            logger.warning(f"Could not verify file existence: {e}")
        
        # presigned URL 생성
        url = s3_client.generate_presigned_url(
            'get_object',
            Params={'Bucket': 'bosk-pdf', 'Key': key},
            ExpiresIn=600  # 10분 유효
        )
        
        return {
            "url": url,
            "filename": decoded_filename,
            "expires_in": 600
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error generating S3 URL: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error generating S3 URL: {str(e)}")


from fastapi import Path

@app.put("/form/{form_id}/status")
async def update_form_status(form_id: int, new_status: str = Body(..., embed=True)):
    """폼의 상태를 업데이트"""
    valid_statuses = {"pending", "approved", "deleted", "confirmed"}
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail="Invalid status")

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("UPDATE forms SET status=%s WHERE id=%s RETURNING id", (new_status, form_id))
        updated = cur.fetchone()
        conn.commit()
        cur.close()
        conn.close()
        if not updated:
            raise HTTPException(status_code=404, detail="Form not found")
        return {"message": f"Form {form_id} status updated to {new_status}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
