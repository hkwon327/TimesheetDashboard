from fastapi import FastAPI, HTTPException, Response, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from PyPDF2 import PdfReader, PdfWriter
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

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
app = FastAPI()

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://192.168.1.31:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection info
DATABASE_URL = "mysql+pymysql://admin:37990000@database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com:3306/database-1"

# 파일 경로 상수 정의
FORM_TEMPLATE_PATH = "/Users/haeun/Desktop/BOSK/Form.pdf"

def get_db_connection():
    return pymysql.connect(
        host='localhost',
        user='root',
        password='rnjs183&RNJS',  # 로컬 MySQL 비밀번호
        database='work_hours_db',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )

@app.get("/")
async def root():
    return {"message": "API is running"}

class ScheduleItem(BaseModel):
    day: str
    date: str
    time: str
    location: str

class ServiceWeek(BaseModel):
    start: str
    end: str

class FormData(BaseModel):
    employeeName: str = Field(..., min_length=1)
    requestorName: str = Field(..., min_length=1)
    requestDate: str
    serviceWeek: Dict[str, str]
    schedule: List[Dict[str, str]]
    signature: Optional[str] = None

    class Config:
        json_schema_extra = {
            "example": {
                "employeeName": "John Doe",
                "requestorName": "Jane Smith",
                "requestDate": "2024-03-20",
                "serviceWeek": {
                    "start": "2024-03-20",
                    "end": "2024-03-24"
                },
                "schedule": [
                    {
                        "day": "Monday",
                        "date": "2024-03-20",
                        "time": "8:00 AM - 5:00 PM",
                        "location": "BOSK Trailer"
                    }
                ]
            }
        }

class NameInput(BaseModel):
    name: str

class FormStatus(str, Enum):
    PENDING = 'pending'
    APPROVED = 'approved'
    REJECTED = 'rejected'

def convert_date_format(date_str: str) -> str:
    """Convert date from 'M/D/YYYY' to 'YYYY-MM-DD' format"""
    try:
        # Parse the date string
        date_obj = datetime.strptime(date_str, '%m/%d/%Y')
        # Convert back to string in MySQL format
        return date_obj.strftime('%Y-%m-%d')
    except ValueError as e:
        print(f"Date conversion error: {str(e)}")
        return date_str

@app.post("/submit-form")
async def submit_form(form_data: FormData):
    conn = None
    cursor = None
    try:
        print("Attempting to connect to database...")
        conn = get_db_connection()
        cursor = conn.cursor()
        
        print("Connected to database, inserting form data...")
        
        form_query = """
        INSERT INTO forms (
            employee_name, requestor_name, request_date, 
            service_week_start, service_week_end, 
            status, submission_date
        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
        """
        
        cursor.execute(form_query, (
            form_data.employeeName,
            form_data.requestorName,
            form_data.requestDate,
            form_data.serviceWeek.get('start'),
            form_data.serviceWeek.get('end'),
            'pending',  # 기본 상태를 'pending'으로 설정
            datetime.now()
        ))
        
        form_id = cursor.lastrowid
        print(f"Form data inserted with ID: {form_id}")
        
        # Insert schedule data with date format conversion
        schedule_query = """
        INSERT INTO schedules (
            form_id, day, date, time, location
        ) VALUES (%s, %s, %s, %s, %s)
        """
        
        for schedule_item in form_data.schedule:
            if schedule_item.get('time') and schedule_item.get('location'):
                # Convert date format before inserting
                formatted_date = convert_date_format(schedule_item.get('date'))
                cursor.execute(schedule_query, (
                    form_id,
                    schedule_item.get('day'),
                    formatted_date,  # 변환된 날짜 사용
                    schedule_item.get('time'),
                    schedule_item.get('location')
                ))
                print(f"Schedule inserted for day: {schedule_item.get('day')} with date: {formatted_date}")
        
        conn.commit()
        print("All data committed successfully")
        return {"message": "Form submitted successfully", "form_id": form_id}
        
    except Exception as e:
        print(f"Error submitting form: {str(e)}")
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@app.post("/generate-pdf")
async def generate_pdf(form_data: FormData):
    try:
        print("Received form data:", form_data.dict())
        
        # Create a new PDF with ReportLab
        buffer = io.BytesIO()
        
        # Use letter size page
        width, height = letter
        
        # Create the canvas
        c = canvas.Canvas(buffer, pagesize=letter)
        
        # Set font
        c.setFont("Helvetica-Bold", 14)
        c.drawString(50, height - 50, "Work Hours Form")
        
        # Set font for regular text
        c.setFont("Helvetica", 12)
        
        # Add basic information
        y_position = height - 100
        
        c.drawString(50, y_position, f"Employee Name: {form_data.employeeName}")
        y_position -= 25
        
        c.drawString(50, y_position, f"Requestor Name: {form_data.requestorName}")
        y_position -= 25
        
        c.drawString(50, y_position, f"Request Date: {form_data.requestDate}")
        y_position -= 25
        
        # Service Week
        c.drawString(50, y_position, 
            f"Service Week: {form_data.serviceWeek.get('start')} - {form_data.serviceWeek.get('end')}")
        y_position -= 40
        
        # Schedule header
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y_position, "Schedule:")
        y_position -= 25
        
        # Schedule details
        c.setFont("Helvetica", 12)
        for schedule_item in form_data.schedule:
            schedule_text = (f"{schedule_item.get('day')} ({schedule_item.get('date')}): "
                           f"{schedule_item.get('time')} at {schedule_item.get('location')}")
            c.drawString(50, y_position, schedule_text)
            y_position -= 20
            
            # Check if we need a new page
            if y_position < 50:
                c.showPage()
                y_position = height - 50
                c.setFont("Helvetica", 12)
        
        # Save the PDF
        c.save()
        
        # Get the value of the BytesIO buffer
        pdf_value = buffer.getvalue()
        buffer.close()
        
        return Response(
            content=pdf_value,
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=work_hours.pdf",
                "Access-Control-Allow-Origin": "http://localhost:3000",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except Exception as e:
        print(f"Error generating PDF: {str(e)}")
        traceback.print_exc()  # 상세한 에러 정보 출력
        raise HTTPException(status_code=500, detail=str(e))

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

@app.get("/dashboard")
async def get_dashboard_data(status: Optional[str] = None):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(pymysql.cursors.DictCursor)
        
        # 기본 쿼리
        query = """
            SELECT 
                f.id as 'No',
                f.employee_name as 'Employee Name',
                f.requestor_name as 'Requester Name',
                f.request_date as 'Request Date',
                CONCAT(f.service_week_start, ' - ', f.service_week_end) as 'Service Week',
                (
                    SELECT COUNT(*) * 9 
                    FROM schedules s 
                    WHERE s.form_id = f.id
                ) as 'Total Hours'
            FROM forms f
        """
        
        # status 파라미터가 있으면 WHERE 절 추가
        if status:
            query += " WHERE f.status = %s"
            cursor.execute(query, (status,))
        else:
            cursor.execute(query)
            
        forms = cursor.fetchall()
        
        # 카운트 쿼리
        cursor.execute("""
            SELECT 
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_count,
                SUM(CASE WHEN submission_date >= DATE_SUB(NOW(), INTERVAL 2 MONTH) THEN 1 ELSE 0 END) as past_2months_count
            FROM forms
        """)
        counts = cursor.fetchone()
        
        return {
            "counts": {
                "pending": counts['pending_count'] or 0,
                "approved": counts['approved_count'] or 0,
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

@app.put("/forms/{form_id}/approve")
async def approve_form(form_id: int):
    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            UPDATE forms 
            SET status = 'approved' 
            WHERE id = %s
        """, (form_id,))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Form not found")
            
        conn.commit()
        return {"message": "Form approved successfully"}
        
    except Exception as e:
        print(f"Error approving form: {str(e)}")
        if conn:
            conn.rollback()
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

if __name__ == "__main__":
    uvicorn.run("main:app", 
                host="127.0.0.1",
                port=8000,
                reload=False)