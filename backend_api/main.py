from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
#from starlette.requests import Request  # 현재 사용되지 않음
#from starlette.responses import FileResponse  # 현재 사용되지 않음


from fastapi import APIRouter
from uuid import uuid4


from backend_api.models import FormData, PdfFormData
from botocore.exceptions import ClientError
from backend_api.utils import upload_pdf_to_s3, parse_date, get_s3_client, build_filled_pdf

from db.connection import get_db_connection

import uuid  # 현재 사용되지 않음
from datetime import datetime
from psycopg2.extras import Json
# import pymysql  # 현재 사용되지 않음

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


# from fastapi.exceptions import RequestValidationError
# from fastapi.responses import JSONResponse
# from fastapi import Request

# @app.exception_handler(RequestValidationError)
# async def validation_exception_handler(request: Request, exc: RequestValidationError):
#     print("🔴 Validation Error:")
#     print(exc.errors())     # 어떤 필드가 문제인지 출력
#     print("🔵 Request Body:")
#     print(exc.body)         # 실제 요청된 JSON도 출력
#     return JSONResponse(
#         status_code=422,
#         content={"detail": exc.errors(), "body": exc.body},
#     )




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


# submit form
# 1. save pdf to s3
# 2. save form data to db
@app.post("/save-to-s3")
async def save_to_s3(form_data: FormData):
    try:
        print("Starting save_to_s3 function...")

        # id가 없으면 생성
        if not form_data.id:
            form_data.id = str(uuid.uuid4())

        filename = f"{form_data.employeeName}_{form_data.id}.pdf"
        s3_client = get_s3_client()

        # PDF 생성 (함수 호출로 간결하게!)
        template_path = "/Users/haeun/Desktop/BOSK/submission-app/public/assets/Form.pdf"  # local path
        # template_path = "/home/ubuntu/Form.pdf"  # EC2 path
        pdf_bytes = build_filled_pdf(template_path, form_data)

        # S3 업로드
        s3_client.put_object(
            Bucket='bosk-pdf',
            Key=f"work-hours-forms/{filename}",
            Body=pdf_bytes,
            ContentType='application/pdf'
        )

        s3_url = f"https://bosk-pdf.s3.amazonaws.com/work-hours-forms/{filename}"
        print(f"S3 URL: {s3_url}")

        return {
            "message": "PDF saved to S3 successfully",
            "file_url": s3_url,
            "form_id": form_data.id
        }

    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        import traceback
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))
    

@app.post("/submit-form")
async def submit_form(form_data: FormData):
    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1️⃣ UUID 생성
        form_id = form_data.id or str(uuid4())

        # 2️⃣ forms 테이블 INSERT
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
                status
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """, (
            form_id,
            form_data.employeeName,
            form_data.requestorName,
            datetime.strptime(form_data.requestDate, "%m/%d/%Y"),
            datetime.strptime(form_data.serviceWeek["start"], "%m/%d/%Y"),
            datetime.strptime(form_data.serviceWeek["end"], "%m/%d/%Y"),
            form_data.signature[:15],
            form_data.isSubmit,
            form_data.status.value
        ))

        # 3️⃣ schedule 테이블에 각 항목 INSERT
        for item in form_data.schedule:
            cur.execute("""
                INSERT INTO form_schedule (
                    form_id,
                    day,
                    time,
                    location
                ) VALUES (%s, %s, %s, %s)
            """, (
                form_id,
                item.day,
                item.time,
                item.location
            ))

        conn.commit()
        cur.close()
        conn.close()

        return {"message": "Form data saved successfully", "id": form_id}

    except Exception as e:
        return {"error": str(e)}

    except Exception as e:
        print("DB insert error:", str(e))
        raise HTTPException(status_code=500, detail="Failed to save data to database.")


