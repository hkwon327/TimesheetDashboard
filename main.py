from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PyPDF2 import PdfReader, PdfWriter, PdfMerger
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
import io
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import logging
import os
import base64
from PIL import Image
from typing import List, Dict, Optional
import uvicorn
import pymysql
from urllib.parse import urlparse
from datetime import datetime, date, timedelta
import traceback
from enum import Enum
from typing import List
from pydantic import BaseModel
from reportlab.lib.utils import ImageReader
import boto3
from botocore.exceptions import ClientError  # 올바른 예외 처리를 위해 추가
import uuid
import requests
import mysql.connector
import pymysql.cursors  # 추가


# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # all traffic allowed
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 모든 HTTP 메서드 허용
    allow_headers=["*"],  # 모든 헤더 허용
    expose_headers=["Content-Disposition"],  # PDF 다운로드 시 필요
)


# RDS Database connection info
DATABASE_URL = "mysql+pymysql://admin:37990000@database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com:3306/database-1"



# AWS RDS 연결 설정
def get_db_connection():
    return pymysql.connect(
        host="database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com",  # AWS RDS 엔드포인트
        user="admin",  # RDS 사용자 이름
        password="37993799!",  # RDS 비밀번호
        database="work_hours_db",  # RDS 데이터베이스 이름
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

# #Local MySQL connection
# def get_db_connection():
#     return pymysql.connect(
#         host='localhost',
#         user='root',
#         password='pwd',  # lcoal MySQL pwd
#         database='work_hours_db', # local MySQL DB name
#         charset='utf8mb4',
#         cursorclass=pymysql.cursors.DictCursor
#     )

def get_s3_client():
    """
    EC2에서 IAM Role을 사용하여 S3 클라이언트를 반환
    """
    try:
        session = requests.Session()
        token_url = "http://169.254.169.254/latest/api/token"
        headers = {"X-aws-ec2-metadata-token-ttl-seconds": "21600"}

        # IMDSv2 security token request
        token_response = session.put(token_url, headers=headers, timeout=1)
        token = token_response.text

        # use token to request EC2 metadata (check if EC2 is running)
        metadata_url = "http://169.254.169.254/latest/meta-data/"
        response = session.get(metadata_url, headers={"X-aws-ec2-metadata-token": token}, timeout=1)

        if response.status_code == 200:
            print("Running on EC2, using IAM role-based authentication")
            return boto3.client('s3')  # use IAM role 
        else:
            raise Exception(f"Unexpected status code: {response.status_code}")

    except requests.RequestException as e:
        print(f"fail to access EC2: {e}")
        raise Exception("Either EC2 is not running or IAM Role is not properly configured.")


@app.get("/")
async def root():
    return {"message": "Server is running"}

class ScheduleItem(BaseModel):
    day: str
    date: str
    time: str
    location: str

    def format_day(self) -> str:
        """Format the day as MM/DD/DAY"""
        try:
            date_obj = datetime.strptime(self.date, '%m-%d-%Y')
            return f"{date_obj.strftime('%m/%d')}/{self.day}"
        except ValueError:
            return self.day

class ServiceWeek(BaseModel):
    start: str
    end: str

class FormData(BaseModel):
    id: str  # id는 필수값으로 설정
    employeeName: str = Field(..., min_length=1)
    requestorName: str = Field(..., min_length=1)
    requestDate: str
    serviceWeek: Dict[str, str]
    schedule: List[Dict[str, str]]
    signature: Optional[str] = None
    isSubmit: Optional[bool] = False

    class Config:
        json_schema_extra = {
            "example": {
                "id": "550e8400-e29b-41d4-a716-446655440000",
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
                        "date": "03/20/2024",
                        "time": "8:00 AM - 5:00 PM",
                        "location": "BOSK Trailer"
                    }
                ]
            }
        }

    def format_schedule_days(self):
        """Format all schedule days as MM/DD/DAY"""
        for item in self.schedule:
            if 'date' in item and 'day' in item:
                try:
                    date_str = convert_date_format(item['date'])
                    date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                    item['day'] = f"{date_obj.strftime('%m/%d')}/{item['day'].split('/')[-1] if '/' in item['day'] else item['day']}"
                    item['date'] = date_str
                except ValueError as e:
                    print(f"Date conversion error: {str(e)}")

        if isinstance(self.serviceWeek, dict):
            if 'start' in self.serviceWeek:
                self.serviceWeek['start'] = convert_date_format(self.serviceWeek['start'])
            if 'end' in self.serviceWeek:
                self.serviceWeek['end'] = convert_date_format(self.serviceWeek['end'])
        
        if self.requestDate:
            self.requestDate = convert_date_format(self.requestDate)

    def __init__(self, **data):
        super().__init__(**data)
        self.format_schedule_days()

class NameInput(BaseModel):
    name: str

class FormStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'
    CONFIRMED = 'confirmed'

def convert_date_format(date_str: str) -> str:
    """Convert various date formats to 'MM/DD/YYYY' format"""
    # 'MM/DD' 형식 처리 추가
    if date_str and len(date_str.split('/')) == 2:
        current_year = datetime.now().year
        date_str = f"{date_str}/{current_year}"
    
    date_formats = [
        '%m/%d/%Y',  # 02/02/2025
        '%m-%d-%Y',  # 02-02-2025
        '%Y-%m-%d',  # 2025-02-02
        '%Y/%m/%d'   # 2025/02/02
    ]
    
    for fmt in date_formats:
        try:
            date_obj = datetime.strptime(date_str, fmt)
            return date_obj.strftime('%m/%d/%Y')
        except ValueError:
            continue
    
    print(f"Could not parse date: {date_str}")
    return date_str


class PdfFormData(BaseModel):
    employeeName: str
    requestorName: str
    requestDate: str
    serviceWeek: dict
    schedule: List[dict]
    signature: str

@app.post("/generate-pdf")
async def generate_pdf(form_data: PdfFormData):
    try:
        #print("Received form data:", form_data.dict()) 
        
        #template_path = "/Users/haeun/Desktop/BOSK/Form.pdf" # local form.pdf path
        template_path = "/home/ubuntu/Form.pdf" # EC2 form.pdf path
        
        if not os.path.exists(template_path):
            raise HTTPException(status_code=404, detail="Template PDF not found")
            
        template_pdf = PdfReader(template_path)
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        
        can.setFont("Helvetica", 10)
        y_position = 710
        
        can.drawString(440, y_position, f"{form_data.requestDate}") #requestor date
        can.drawString(440, y_position - 32, f" {form_data.requestorName}") #request name
        can.drawString(215, y_position-135, f"{form_data.employeeName}") #interpreter name

        if form_data.schedule and len(form_data.schedule) > 0:
            can.drawString(215, y_position - 170, f"{form_data.schedule[0]['location']}")  # service location

        service_week = form_data.serviceWeek
        can.drawString(210, y_position - 210, f" {service_week['start']} ~ {service_week['end']}") #service date
        
        #purpose
        y_position -= 270
        for schedule_item in form_data.schedule:
            can.drawString(150, y_position, f"{schedule_item['day']}")  # day on the left
            can.drawString(260, y_position, f"{schedule_item['time']}")  # time in the middle
            can.drawString(400, y_position, f"{schedule_item['location']}")  # location on the right
            y_position -= 30
        
        can.drawString(320, y_position-60, f"{form_data.employeeName}") #employee siganture

        print("Checking signature data...")
        if hasattr(form_data, 'signature') and form_data.signature:  # None이 아닌지도 확인
            print("Signature exists in form_data")
            print("Signature type:", type(form_data.signature))
            #print("Signature starts with:", form_data.signature[:10] if form_data.signature else "None") 
            
            try:
                # base64 문자열에서 실제 이미지 데이터 부분만 추출
                if ',' in form_data.signature:
                    print("Found comma in signature data")
                    signature_data = form_data.signature.split(',')[1]
                else:
                    print("No comma found in signature data")
                    signature_data = form_data.signature
                
                print("Signature data length:", len(signature_data))
                print("Processing signature data...")
                
                try:
                    signature_bytes = base64.b64decode(signature_data)
                    print("Successfully decoded base64 data")
                    signature_image = io.BytesIO(signature_bytes)
                    
                    #print("Drawing signature on PDF...")
                    can.drawImage(
                        ImageReader(signature_image),
                        x=320,  
                        y=170,  
                        width=150,
                        height=50,
                        mask='auto'
                    )
                    print("Successfully drew signature")
                    
                except Exception as decode_error:
                    print("Error decoding signature:", str(decode_error))
                    print("First few characters of signature_data:", signature_data[:30])
                    
            except Exception as e:
                print("Error processing signature:", str(e))
                print("Error type:", type(e))
        else:
            print("No signature data found in form_data")
        
        can.save()
        packet.seek(0)
        
        new_pdf = PdfReader(packet)
        output = PdfWriter()
        page = template_pdf.pages[0]
        page.merge_page(new_pdf.pages[0])
        output.add_page(page)
        
        output_stream = io.BytesIO()
        output.write(output_stream)
        pdf_value = output_stream.getvalue()
        
        return Response(
            content=pdf_value,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=preview.pdf",
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, GET",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )
        
    except Exception as e:
        print("Error generating PDF:", str(e))
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/test-s3-connection")
async def test_s3_connection():
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


@app.post("/save-to-s3")
async def save_to_s3(form_data: FormData):
    try:
        print("Starting save_to_s3 function...")
        
        # id가 없으면 생성 (빈 문자열인 경우도 처리)
        if not form_data.id:
            form_data.id = str(uuid.uuid4())
            
        s3_client = get_s3_client()
        filename = f"{form_data.employeeName}_{form_data.id}.pdf"
        print(f"Generated filename: {filename}")
        
        template_path = "/home/ubuntu/Form.pdf" # EC2 form.pdf path
        
        if not os.path.exists(template_path):
            raise HTTPException(status_code=404, detail="Template PDF not found")
            
        template_pdf = PdfReader(template_path)
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        
        can.setFont("Helvetica", 10)
        y_position = 710
        
        can.drawString(440, y_position, f"{form_data.requestDate}") #requestor date
        can.drawString(440, y_position - 32, f" {form_data.requestorName}") #request name
        can.drawString(215, y_position-135, f"{form_data.employeeName}") #interpreter name

        if form_data.schedule and len(form_data.schedule) > 0:
            can.drawString(215, y_position - 170, f"{form_data.schedule[0]['location']}")  # service location

        service_week = form_data.serviceWeek
        can.drawString(210, y_position - 210, f" {service_week['start']} ~ {service_week['end']}") #service date
        
        #purpose
        y_position -= 270
        for schedule_item in form_data.schedule:
            can.drawString(150, y_position, f"{schedule_item['day']}")  # day on the left
            can.drawString(260, y_position, f"{schedule_item['time']}")  # time in the middle
            can.drawString(400, y_position, f"{schedule_item['location']}")  # location on the right
            y_position -= 30
        
        can.drawString(320, y_position-60, f"{form_data.employeeName}") #employee siganture

        print("Checking signature data...")
        if hasattr(form_data, 'signature') and form_data.signature:  # None이 아닌지도 확인
            #print("Signature exists in form_data")
            #print("Signature type:", type(form_data.signature))
            #print("Signature starts with:", form_data.signature[:10] if form_data.signature else "None") 
            
            try:
                # base64 문자열에서 실제 이미지 데이터 부분만 추출
                if ',' in form_data.signature:
                    print("Found comma in signature data")
                    signature_data = form_data.signature.split(',')[1]
                else:
                    print("No comma found in signature data")
                    signature_data = form_data.signature
                
                print("Signature data length:", len(signature_data))
                print("Processing signature data...")
                
                signature_bytes = base64.b64decode(signature_data)
                print("Successfully decoded base64 data")
                signature_image = io.BytesIO(signature_bytes)
                    
                    #print("Drawing signature on PDF...")
                can.drawImage(
                    ImageReader(signature_image),
                    x=320,  
                    y=170,  
                    width=150,
                    height=50,
                    mask='auto'
                )
                print("Successfully drew signature")
            except Exception as e:
                print("Error processing signature:", str(e))
                print("Error type:", type(e))

        # signature 블록 밖으로 이동
        can.save()
        packet.seek(0)
        
        new_pdf = PdfReader(packet)
        output = PdfWriter()
        page = template_pdf.pages[0]
        page.merge_page(new_pdf.pages[0])
        output.add_page(page)
        
        # PDF를 바이트로 변환
        output_stream = io.BytesIO()
        output.write(output_stream)
        pdf_value = output_stream.getvalue()
        
        print("Uploading to S3...")
        s3_client.put_object(
            Bucket='bosk-pdf',  # designated bucket name
            Key=f"work-hours-forms/{filename}",
            Body=pdf_value,
            ContentType='application/pdf'
        )
        
        s3_url = f"https://bosk-pdf.s3.amazonaws.com/work-hours-forms/{filename}"
        print(f"S3 URL generated: {s3_url}")
        
        return {
            "message": "PDF saved to S3 successfully", 
            "file_url": s3_url,
            "form_id": form_data.id  # 생성된 ID 반환
        }
        
    except ClientError as e:
        print(f"AWS S3 Error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))

# send form data to AWS RDS DB
@app.post("/submit-form")
async def submit_form(form_data: FormData):
    try:
        print("🔍 Connecting to AWS RDS database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("✅ Connected to RDS, inserting form data...")
        
        # S3에 저장할 때 사용한 ID를 그대로 사용
        form_id = form_data.id
        
        print(f"Using S3 file's form_id: {form_id}")  # 로그 추가
        
        # forms 테이블에 데이터 삽입
        form_query = """
        INSERT INTO forms (
            form_id, employee_name, requestor_name, 
            request_date, service_week_start, service_week_end, 
            status
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        def parse_date(date_str):
            if not date_str:
                return None
            try:
                # MM/DD/YYYY 형식 처리
                if '/' in date_str:
                    return datetime.strptime(date_str, '%m/%d/%Y').date()
                # YYYY-MM-DD 형식 처리
                return datetime.strptime(date_str, '%Y-%m-%d').date()
            except ValueError as e:
                print(f"Date parsing error: {str(e)} for date: {date_str}")
                return None

        # 날짜 형식 변환
        request_date = parse_date(form_data.requestDate)
        service_week_start = parse_date(form_data.serviceWeek['start'])
        service_week_end = parse_date(form_data.serviceWeek['end'])

        cursor.execute(form_query, (
            form_id,
            form_data.employeeName,
            form_data.requestorName,
            request_date,
            service_week_start,
            service_week_end,
            'pending'
        ))
        print(f"✅ Form data inserted with ID: {form_id}")
        
        # schedules 테이블에 데이터 삽입
        schedule_query = """
        INSERT INTO schedules (
            form_id, day, date, time, location  # 실제 테이블 구조와 일치
        ) VALUES (%s, %s, %s, %s, %s)  # 5개의 placeholder
        """

        for schedule_item in form_data.schedule:
            if schedule_item.get('time') and schedule_item.get('location'):
                formatted_date = convert_date_format(schedule_item.get('date'))
                cursor.execute(schedule_query, (
                    form_id,      # form의 UUID
                    schedule_item.get('day'),
                    formatted_date,
                    schedule_item.get('time'),
                    schedule_item.get('location')
                ))
                print(f"✅ Schedule inserted for day: {schedule_item.get('day')} with date: {formatted_date}")
        
        conn.commit()
        print("✅ All data committed successfully")
        return {"message": "Form submitted successfully", "form_id": form_id}
        
    except Exception as e:
        print(f"❌ Error submitting form: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# Request body model
class FormIdsRequest(BaseModel):
    form_ids: List[str]


########################################################
@app.post("/approve-forms")
async def approve_forms(form_data: FormIdsRequest):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # pending -> approved
        update_query = """
        UPDATE forms 
        SET status = 'approved' 
        WHERE form_id IN (%s) AND status = 'pending'
        """
        
        # 폼 ID 리스트를 쿼리에 맞는 형식으로 변환
        placeholders = ', '.join(['%s'] * len(form_data.form_ids))
        query = update_query % placeholders
        
        cursor.execute(query, form_data.form_ids)
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="No forms were approved. Forms might not exist or not be in pending status")
        
        conn.commit()
        return {"message": f"{cursor.rowcount} forms approved successfully"}
    
    except Exception as e:
        if conn:
            conn.rollback()
        print(f"Error approving forms: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.get("/dashboard")
async def get_dashboard_data(status: Optional[str] = None):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        # 기본 쿼리
        base_query = """
            SELECT 
                f.form_id as 'No',
                f.employee_name as 'Employee Name',
                f.requestor_name as 'Requester Name',
                f.request_date as 'Request Date',
                CONCAT(f.service_week_start, ' - ', f.service_week_end) as 'Service Week',
                45 as 'Total Hours',
                f.status as 'Status'
            FROM forms f
            WHERE 1=1
        """
        
        # status에 따른 조건 추가
        if status == 'pending':
            base_query += " AND f.status = 'pending'"
        elif status == 'approved':
            base_query += " AND f.status = 'approved'"
        elif status == 'confirmed':
            base_query += " AND f.status = 'confirmed'"
        elif status == 'past_2months':
            # past_2months에는 모든 상태(pending 제외)의 데이터를 포함
            base_query += """ 
                AND f.submission_date >= DATE_SUB(NOW(), INTERVAL 2 MONTH)
                AND f.status != 'pending'
            """
        
        # 데이터 조회
        cursor.execute(base_query)
        forms = cursor.fetchall()
        
        # 각 상태별 카운트 조회
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed_count,
                SUM(CASE 
                    WHEN submission_date >= DATE_SUB(NOW(), INTERVAL 2 MONTH)
                    AND status != 'pending'
                    THEN 1 ELSE 0 END) as past_2months_count
            FROM forms
        """)
        counts = cursor.fetchone()
        
        return {
            "counts": {
                "pending": counts['pending_count'] or 0,
                "approved": counts['approved_count'] or 0,
                "confirmed": counts['confirmed_count'] or 0,
                "past_2months": counts['past_2months_count'] or 0
            },
            "forms": list(forms)
        }
        
    except Exception as e:
        print(f"Error fetching dashboard data: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.delete("/forms/{form_id}")
async def delete_form(form_id: int):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # 먼저 schedules 삭제
        cursor.execute("DELETE FROM schedules WHERE form_id = %s", (form_id,))
        
        # 그 다음 form 삭제
        cursor.execute("DELETE FROM forms WHERE id = %s", (form_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Form not found")
            
        conn.commit()
        return {"message": "Form deleted successfully"}
        
    except Exception as e:
        print(f"Error deleting form: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


@app.put("/forms/{form_id}/status")
async def update_form_status(form_id: int, status: FormStatus):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE forms 
            SET status = %s 
            WHERE id = %s
        """, (status, form_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Form not found")
            
        conn.commit()
        return {"message": f"Form status updated to {status}"}
        
    except Exception as e:
        print(f"Error updating form status: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.put("/forms/{form_id}/approve")
async def approve_form(form_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # pending -> approved
        update_query = """
        UPDATE forms 
        SET status = %s 
        WHERE form_id = %s AND status = 'pending'
        """
        cursor.execute(update_query, ('approved', form_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="Form not found or not in pending status")
        
        conn.commit()
        return {"message": "Form approved successfully"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.put("/forms/{form_id}/reject")
async def reject_form(form_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # pending -> rejected
        update_query = """
        UPDATE forms 
        SET status = %s 
        WHERE form_id = %s AND status = 'pending'
        """
        cursor.execute(update_query, ('rejected', form_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="Form not found or not in pending status")
        
        conn.commit()
        return {"message": "Form rejected successfully"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.put("/forms/{form_id}/confirm")
async def confirm_form(form_id: str):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # approved -> confirmed
        update_query = """
        UPDATE forms 
        SET status = %s 
        WHERE form_id = %s AND status = 'approved'
        """
        cursor.execute(update_query, ('confirmed', form_id))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="Form not found or not in approved status")
        
        conn.commit()
        return {"message": "Form confirmed successfully"}
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.get("/forms/{form_id}/download")
async def download_pdf(form_id: int):
    try:
        # 1. MySQL에서 form_id에 해당하는 employeeName과 requestDate 가져오기
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        
        cursor.execute("""
            SELECT employee_name, request_date 
            FROM forms 
            WHERE id = %s
        """, (form_id,))
        
        form_data = cursor.fetchone()
        if not form_data:
            raise HTTPException(status_code=404, detail="Form not found")
            
        # 2. S3에서 파일 가져오기
        filename = f"{form_data['employee_name']}_{form_data['request_date']}.pdf"
        s3_path = f"work-hours-forms/{filename}"
        
        s3_client = get_s3_client()
        
        try:
            response = s3_client.get_object(
                Bucket='bosk-pdf',
                Key=s3_path
            )
            pdf_content = response['Body'].read()
            
            return Response(
                content=pdf_content,
                media_type="application/pdf",
                headers={
                    "Content-Disposition": f"attachment; filename={filename}",
                    "Access-Control-Allow-Origin": "*"
                }
            )
            
        except s3_client.exceptions.NoSuchKey:
            raise HTTPException(status_code=404, detail="PDF file not found in S3")
            
    except Exception as e:
        print(f"Error downloading PDF: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

########################################################

def get_mysql_connection():
    return mysql.connector.connect(
        host="database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com",
        user="admin",
        password="37993799!",  # MySQL 비밀번호
        database="work_hours_db",  # 데이터베이스 이름
          charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor
    )

@app.post("/forms/merge-preview")
async def merge_pdfs_preview(request: FormIdsRequest):
    try:
        s3_client = boto3.client('s3')
        
        conn = get_db_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        merger = PdfMerger()
        has_pdfs = False
        
        for form_id in request.form_ids:
            cursor.execute("""
                SELECT employee_name, request_date, form_id 
                FROM forms 
                WHERE form_id = %s
            """, (form_id,))
            
            result = cursor.fetchone()
            if not result:
                print(f"Form not found for form_id: {form_id}")
                continue
            
            employee_name = result['employee_name']
            form_id = result['form_id']
            
            # 파일명 생성 - save-to-s3와 동일한 형식 사용
            s3_path = f"work-hours-forms/{employee_name}_{form_id}.pdf"
            
            print(f"Trying to get file: {s3_path}")
            
            try:
                response = s3_client.get_object(
                    Bucket='bosk-pdf',
                    Key=s3_path
                )
                pdf_content = response['Body'].read()
                pdf_file = io.BytesIO(pdf_content)
                merger.append(pdf_file)
                has_pdfs = True
                print(f"Successfully added {s3_path} to merger")
                
            except s3_client.exceptions.NoSuchKey:
                print(f"PDF not found in S3: {s3_path}")
                continue
            
        if not has_pdfs:
            raise HTTPException(status_code=404, detail="No PDFs found to merge")
        
        # 병합된 PDF를 메모리에 저장
        output = io.BytesIO()
        merger.write(output)
        output.seek(0)
        
        return Response(
            content=output.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=merged.pdf",
                "Access-Control-Allow-Origin": "*"
            }
        )
        
    except Exception as e:
        print(f"Error merging PDFs: {str(e)}")
        print(f"Error type: {type(e)}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    uvicorn.run("main:app", 
                host="127.0.0.1",
                port=8000,
                reload=False)