from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware

from psycopg2.extras import RealDictCursor


from fastapi import APIRouter
from uuid import uuid4


from backend_api.models import FormData, PdfFormData
from botocore.exceptions import ClientError
from backend_api.utils import get_s3_client, build_filled_pdf

from db.connection import get_db_connection

import uuid  # 현재 사용되지 않음
from datetime import datetime
from psycopg2.extras import Json
from urllib.parse import unquote


import logging

# 로깅 설정
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)



# FastAPI 앱 초기화
app = FastAPI()

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition"]
)



# 루트 헬스체크
@app.get("/")
async def root():
    print("Server is running")
    return {"message": "Server is running"}


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


@app.post("/submit-form")
async def submit_form(form_data: FormData):
    try:
        # ✅ ID 생성 (없으면 새로)
        if not form_data.id:
            form_data.id = str(uuid4())

        form_id = form_data.id
        filename = f"{form_data.employeeName}_{form_id}.pdf"
        s3_client = get_s3_client()

        # ✅ PDF 생성
        template_path = "/Users/haeun/Desktop/BOSK/submission-app/public/assets/Form.pdf"
        pdf_bytes = build_filled_pdf(template_path, form_data)

        # ✅ S3 업로드
        s3_client.put_object(
            Bucket='bosk-pdf',
            Key=f"work-hours-forms/{filename}",
            Body=pdf_bytes,
            ContentType='application/pdf'
        )

        # ✅ DB 저장
        conn = get_db_connection()
        cur = conn.cursor()

        now = datetime.utcnow()
        cur.execute("""
            INSERT INTO forms (
                id,
                employee_name,
                requestor_name,
                request_date,
                service_week_start,
                service_week_end,
                signature,
                is_submit,
                status,
                created_date,
                created_time,
                pdf_filename
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            form_id,
            form_data.employeeName,
            form_data.requestorName,
            datetime.strptime(form_data.requestDate, "%m/%d/%Y"),
            datetime.strptime(form_data.serviceWeek["start"], "%m/%d/%Y"),
            datetime.strptime(form_data.serviceWeek["end"], "%m/%d/%Y"),
            form_data.signature[:15],
            form_data.isSubmit,
            form_data.status.value,
            now.date(),
            now.time(),
            filename
        ))

        for item in form_data.schedule:
            cur.execute("""
                INSERT INTO form_schedule (form_id, day, time, location)
                VALUES (%s, %s, %s, %s)
            """, (
                form_id,
                item.day,
                item.time,
                item.location
            ))

        conn.commit()
        cur.close()
        conn.close()

        return {
            "message": "Form saved to S3 and DB",
            "form_id": form_id,
            "s3_filename": filename,
            "pdf_url": f"https://bosk-pdf.s3.amazonaws.com/work-hours-forms/{filename}",
            "created_date": now.date(),
            "created_time": now.time()
        }

    except ClientError as e:
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    

@app.get("/forms")
async def get_forms():
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
            created_date,
            created_time,
            pdf_filename
        FROM forms
        ORDER BY request_date DESC;
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
            time_range = schedule['time']
            hours = calculate_hours_from_range(time_range)
            total_hours += hours
        
        form['total_hours'] = round(total_hours, 2)
    
    cur.close()
    conn.close()
    return forms

def calculate_hours_from_range(time_range):
    """시간 범위 문자열에서 시간 계산"""
    try:
        if not time_range or ' - ' not in str(time_range):
            return 0
            
        start_time_str, end_time_str = str(time_range).split(' - ')
        
        # 시간을 24시간 형식으로 변환
        start_hour = datetime.strptime(start_time_str.strip(), '%I:%M %p').hour
        start_minute = datetime.strptime(start_time_str.strip(), '%I:%M %p').minute
        
        end_hour = datetime.strptime(end_time_str.strip(), '%I:%M %p').hour
        end_minute = datetime.strptime(end_time_str.strip(), '%I:%M %p').minute
        
        # 분 단위로 변환
        start_minutes = start_hour * 60 + start_minute
        end_minutes = end_hour * 60 + end_minute
        
        # 자정을 넘어가는 경우
        if end_minutes <= start_minutes:
            end_minutes += 24 * 60  # 다음날로 계산
        
        # 시간 차이 계산
        diff_minutes = end_minutes - start_minutes
        hours = diff_minutes / 60
        
        return hours
    except Exception as e:
        print(f"Time parsing error: {e}, time_range: {time_range}")
        return 0



@app.get("/form/{form_id}")
async def get_form_with_schedule(form_id: str):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)  # ✅ 반드시 이렇게

    cur.execute("SELECT * FROM forms WHERE id = %s", (form_id,))
    form = cur.fetchone()

    cur.execute("SELECT day, time, location FROM form_schedule WHERE form_id = %s", (form_id,))
    schedule = cur.fetchall()

    cur.close()
    conn.close()

    return {"form": form, "schedule": schedule}



@app.get("/form-pdf-url/{pdf_filename}")
def get_pdf_presigned_url(pdf_filename: str):
    s3_client = get_s3_client()
    key = f"work-hours-forms/{unquote(pdf_filename).strip()}"
    
    try:
        url = s3_client.generate_presigned_url(
            ClientMethod="get_object",
            Params={"Bucket": "bosk-pdf", "Key": key},
            ExpiresIn=600  # 10분 유효
        )
        return {"url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating S3 URL: {e}")


