# from fastapi import FastAPI, HTTPException, Response, Query
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel, Field
# from PyPDF2 import PdfReader, PdfWriter, PdfMerger
# from reportlab.pdfgen import canvas
# from reportlab.lib.pagesizes import letter
# import io
# from reportlab.pdfbase import pdfmetrics
# from reportlab.pdfbase.ttfonts import TTFont
# import logging
# import os
# import base64
# from PIL import Image
# from typing import List, Dict, Optional
# import uvicorn
# import pymysql
# from urllib.parse import urlparse
# from datetime import datetime, date, timedelta
# import traceback
# from enum import Enum
# from typing import List
# from pydantic import BaseModel
# from reportlab.lib.utils import ImageReader
# import boto3
# from botocore.exceptions import ClientError  # 올바른 예외 처리를 위해 추가
# import uuid
# import requests
# import mysql.connector
# import pymysql.cursors  # 추가


# # Set up logging
# logging.basicConfig(level=logging.DEBUG)
# logger = logging.getLogger(__name__)
# app = FastAPI()


# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # all traffic allowed
#     allow_credentials=False,
#     allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],  # 모든 HTTP 메서드 허용
#     allow_headers=["*"],  # 모든 헤더 허용
#     expose_headers=["Content-Disposition"],  # PDF 다운로드 시 필요
# )


# # RDS Database connection info
# DATABASE_URL = "mysql+pymysql://admin:37990000@database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com:3306/database-1"



# # AWS RDS 연결 설정
# def get_db_connection():
#     return pymysql.connect(
#         host="database-1.c6t0ka0ycpz2.us-east-1.rds.amazonaws.com",  # AWS RDS 엔드포인트
#         user="admin",  # RDS 사용자 이름
#         password="37993799!",  # RDS 비밀번호
#         database="work_hours_db",  # RDS 데이터베이스 이름
#         charset="utf8mb4",
#         cursorclass=pymysql.cursors.DictCursor
#     )

# # #Local MySQL connection
# # def get_db_connection():
# #     return pymysql.connect(
# #         host='localhost',
# #         user='root',
# #         password='pwd',  # lcoal MySQL pwd
# #         database='work_hours_db', # local MySQL DB name
# #         charset='utf8mb4',
# #         cursorclass=pymysql.cursors.DictCursor
# #     )

# def get_s3_client():
#     """
#     EC2에서 IAM Role을 사용하여 S3 클라이언트를 반환
#     """
#     try:
#         session = requests.Session()
#         token_url = "http://169.254.169.254/latest/api/token"
#         headers = {"X-aws-ec2-metadata-token-ttl-seconds": "21600"}

#         # IMDSv2 security token request
#         token_response = session.put(token_url, headers=headers, timeout=1)
#         token = token_response.text

#         # use token to request EC2 metadata (check if EC2 is running)
#         metadata_url = "http://169.254.169.254/latest/meta-data/"
#         response = session.get(metadata_url, headers={"X-aws-ec2-metadata-token": token}, timeout=1)

#         if response.status_code == 200:
#             print("Running on EC2, using IAM role-based authentication")
#             return boto3.client('s3')  # use IAM role 
#         else:
#             raise Exception(f"Unexpected status code: {response.status_code}")

#     except requests.RequestException as e:
#         print(f"fail to access EC2: {e}")
#         raise Exception("Either EC2 is not running or IAM Role is not properly configured.")


# @app.get("/")
# async def root():
#     return {"message": "Server is running"}

# class ScheduleItem(BaseModel):
#     day: str
#     date: str
#     time: str
#     location: str

#     def format_day(self) -> str:
#         """Format the day as MM/DD/DAY"""
#         try:
#             date_obj = datetime.strptime(self.date, '%m-%d-%Y')
#             return f"{date_obj.strftime('%m/%d')}/{self.day}"
#         except ValueError:
#             return self.day

# class ServiceWeek(BaseModel):
#     start: str
#     end: str

# class FormData(BaseModel):
#     id: str  # id는 필수값으로 설정
#     employeeName: str = Field(..., min_length=1)
#     requestorName: str = Field(..., min_length=1)
#     requestDate: str
#     serviceWeek: Dict[str, str]
#     schedule: List[Dict[str, str]]
#     signature: Optional[str] = None
#     isSubmit: Optional[bool] = False

#     class Config:
#         json_schema_extra = {
#             "example": {
#                 "id": "550e8400-e29b-41d4-a716-446655440000",
#                 "employeeName": "John Doe",
#                 "requestorName": "Jane Smith",
#                 "requestDate": "03/20/2024",
#                 "serviceWeek": {
#                     "start": "03/20/2024",
#                     "end": "03/24/2024"
#                 },
#                 "schedule": [
#                     {
#                         "day": "03/20/Monday",
#                         "date": "03/20/2024",
#                         "time": "8:00 AM - 5:00 PM",
#                         "location": "BOSK Trailer"
#                     }
#                 ]
#             }
#         }

#     def format_schedule_days(self):
#         """Format all schedule days as MM/DD/DAY"""
#         for item in self.schedule:
#             if 'date' in item and 'day' in item:
#                 try:
#                     date_str = convert_date_format(item['date'])
#                     date_obj = datetime.strptime(date_str, '%m/%d/%Y')
#                     item['day'] = f"{date_obj.strftime('%m/%d')}/{item['day'].split('/')[-1] if '/' in item['day'] else item['day']}"
#                     item['date'] = date_str
#                 except ValueError as e:
#                     print(f"Date conversion error: {str(e)}")

#         if isinstance(self.serviceWeek, dict):
#             if 'start' in self.serviceWeek:
#                 self.serviceWeek['start'] = convert_date_format(self.serviceWeek['start'])
#             if 'end' in self.serviceWeek:
#                 self.serviceWeek['end'] = convert_date_format(self.serviceWeek['end'])
        
#         if self.requestDate:
#             self.requestDate = convert_date_format(self.requestDate)

#     def __init__(self, **data):
#         super().__init__(**data)
#         self.format_schedule_days()

# class NameInput(BaseModel):
#     name: str

# class FormStatus(str, Enum):
#     PENDING = 'pending'
#     APPROVED = 'approved'
#     REJECTED = 'rejected'
#     CONFIRMED = 'confirmed'

# def convert_date_format(date_str: str) -> str:
#     """Convert various date formats to 'MM/DD/YYYY' format"""
#     # 'MM/DD' 형식 처리 추가
#     if date_str and len(date_str.split('/')) == 2:
#         current_year = datetime.now().year
#         date_str = f"{date_str}/{current_year}"
    
#     date_formats = [
#         '%m/%d/%Y',  # 02/02/2025
#         '%m-%d-%Y',  # 02-02-2025
#         '%Y-%m-%d',  # 2025-02-02
#         '%Y/%m/%d'   # 2025/02/02
#     ]
    
#     for fmt in date_formats:
#         try:
#             date_obj = datetime.strptime(date_str, fmt)
#             return date_obj.strftime('%m/%d/%Y')
#         except ValueError:
#             continue
    
#     print(f"Could not parse date: {date_str}")
#     return date_str


# class PdfFormData(BaseModel):
#     employeeName: str
#     requestorName: str
#     requestDate: str
#     serviceWeek: dict
#     schedule: List[dict]
#     signature: str

# @app.post("/generate-pdf")
# async def generate_pdf(form_data: PdfFormData):
#     try:
#         #print("Received form data:", form_data.dict()) 
        
#         #template_path = "/Users/haeun/Desktop/BOSK/Form.pdf" # local form.pdf path
#         template_path = "/home/ubuntu/Form.pdf" # EC2 form.pdf path
        
#         if not os.path.exists(template_path):
#             raise HTTPException(status_code=404, detail="Template PDF not found")
            
#         template_pdf = PdfReader(template_path)
#         packet = io.BytesIO()
#         can = canvas.Canvas(packet, pagesize=letter)
        
#         can.setFont("Helvetica", 10)
#         y_position = 710
        
#         can.drawString(440, y_position, f"{form_data.requestDate}") #requestor date
#         can.drawString(440, y_position - 32, f" {form_data.requestorName}") #request name
#         can.drawString(215, y_position-135, f"{form_data.employeeName}") #interpreter name

#         if form_data.schedule and len(form_data.schedule) > 0:
#             can.drawString(215, y_position - 170, f"{form_data.schedule[0]['location']}")  # service location

#         service_week = form_data.serviceWeek
#         can.drawString(210, y_position - 210, f" {service_week['start']} ~ {service_week['end']}") #service date
        
#         #purpose
#         y_position -= 270
#         for schedule_item in form_data.schedule:
#             can.drawString(150, y_position, f"{schedule_item['day']}")  # day on the left
#             can.drawString(260, y_position, f"{schedule_item['time']}")  # time in the middle
#             can.drawString(400, y_position, f"{schedule_item['location']}")  # location on the right
#             y_position -= 30
        
#         can.drawString(320, y_position-60, f"{form_data.employeeName}") #employee siganture

#         print("Checking signature data...")
#         if hasattr(form_data, 'signature') and form_data.signature:  # None이 아닌지도 확인
#             print("Signature exists in form_data")
#             print("Signature type:", type(form_data.signature))
#             #print("Signature starts with:", form_data.signature[:10] if form_data.signature else "None") 
            
#             try:
#                 # base64 문자열에서 실제 이미지 데이터 부분만 추출
#                 if ',' in form_data.signature:
#                     print("Found comma in signature data")
#                     signature_data = form_data.signature.split(',')[1]
#                 else:
#                     print("No comma found in signature data")
#                     signature_data = form_data.signature
                
#                 print("Signature data length:", len(signature_data))
#                 print("Processing signature data...")
                
#                 try:
#                     signature_bytes = base64.b64decode(signature_data)
#                     print("Successfully decoded base64 data")
#                     signature_image = io.BytesIO(signature_bytes)
                    
#                     #print("Drawing signature on PDF...")
#                     can.drawImage(
#                         ImageReader(signature_image),
#                         x=320,  
#                         y=170,  
#                         width=150,
#                         height=50,
#                         mask='auto'
#                     )
#                     print("Successfully drew signature")
                    
#                 except Exception as decode_error:
#                     print("Error decoding signature:", str(decode_error))
#                     print("First few characters of signature_data:", signature_data[:30])
                    
#             except Exception as e:
#                 print("Error processing signature:", str(e))
#                 print("Error type:", type(e))
#         else:
#             print("No signature data found in form_data")
        
#         can.save()
#         packet.seek(0)
        
#         new_pdf = PdfReader(packet)
#         output = PdfWriter()
#         page = template_pdf.pages[0]
#         page.merge_page(new_pdf.pages[0])
#         output.add_page(page)
        
#         output_stream = io.BytesIO()
#         output.write(output_stream)
#         pdf_value = output_stream.getvalue()
        
#         return Response(
#             content=pdf_value,
#             media_type="application/pdf",
#             headers={
#                 "Content-Disposition": "inline; filename=preview.pdf",
#                 "Access-Control-Allow-Origin": "*",
#                 "Access-Control-Allow-Methods": "POST, GET",
#                 "Access-Control-Allow-Headers": "Content-Type"
#             }
#         )
        
#     except Exception as e:
#         print("Error generating PDF:", str(e))
#         raise HTTPException(status_code=500, detail=str(e))


# @app.get("/test-s3-connection")
# async def test_s3_connection():
#     try:
#         print("Testing S3 connection...")
#         s3_client = get_s3_client()
        
#         print("Getting bucket list...")
#         response = s3_client.list_buckets()
#         buckets = [bucket['Name'] for bucket in response['Buckets']]
        
#         print(f"Found buckets: {buckets}")
#         return {
#             "message": "S3 connection successful",
#             "buckets": buckets
#         }
#     except Exception as e:
#         print(f"Error testing S3 connection: {str(e)}")
#         print(f"Error type: {type(e)}")
#         import traceback
#         print(f"Traceback: {traceback.format_exc()}")
#         raise HTTPException(status_code=500, detail=str(e))


# @app.post("/save-to-s3")
# async def save_to_s3(form_data: FormData):
#     try:
#         print("Starting save_to_s3 function...")
        
#         # id가 없으면 생성 (빈 문자열인 경우도 처리)
#         if not form_data.id:
#             form_data.id = str(uuid.uuid4())
            
#         s3_client = get_s3_client()
#         filename = f"{form_data.employeeName}_{form_data.id}.pdf"
#         print(f"Generated filename: {filename}")
        
#         template_path = "/home/ubuntu/Form.pdf" # EC2 form.pdf path
        
#         if not os.path.exists(template_path):
#             raise HTTPException(status_code=404, detail="Template PDF not found")
            
#         template_pdf = PdfReader(template_path)
#         packet = io.BytesIO()
#         can = canvas.Canvas(packet, pagesize=letter)
        
#         can.setFont("Helvetica", 10)
#         y_position = 710
        
#         can.drawString(440, y_position, f"{form_data.requestDate}") #requestor date
#         can.drawString(440, y_position - 32, f" {form_data.requestorName}") #request name
#         can.drawString(215, y_position-135, f"{form_data.employeeName}") #interpreter name

#         if form_data.schedule and len(form_data.schedule) > 0:
#             can.drawString(215, y_position - 170, f"{form_data.schedule[0]['location']}")  # service location

#         service_week = form_data.serviceWeek
#         can.drawString(210, y_position - 210, f" {service_week['start']} ~ {service_week['end']}") #service date
        
#         #purpose
#         y_position -= 270
#         for schedule_item in form_data.schedule:
#             can.drawString(150, y_position, f"{schedule_item['day']}")  # day on the left
#             can.drawString(260, y_position, f"{schedule_item['time']}")  # time in the middle
#             can.drawString(400, y_position, f"{schedule_item['location']}")  # location on the right
#             y_position -= 30
        
#         can.drawString(320, y_position-60, f"{form_data.employeeName}") #employee siganture

#         print("Checking signature data...")
#         if hasattr(form_data, 'signature') and form_data.signature:  # None이 아닌지도 확인
#             #print("Signature exists in form_data")
#             #print("Signature type:", type(form_data.signature))
#             #print("Signature starts with:", form_data.signature[:10] if form_data.signature else "None") 
            
#             try:
#                 # base64 문자열에서 실제 이미지 데이터 부분만 추출
#                 if ',' in form_data.signature:
#                     print("Found comma in signature data")
#                     signature_data = form_data.signature.split(',')[1]
#                 else:
#                     print("No comma found in signature data")
#                     signature_data = form_data.signature
                
#                 print("Signature data length:", len(signature_data))
#                 print("Processing signature data...")
                
#                 signature_bytes = base64.b64decode(signature_data)
#                 print("Successfully decoded base64 data")
#                 signature_image = io.BytesIO(signature_bytes)
                    
#                     #print("Drawing signature on PDF...")
#                 can.drawImage(
#                     ImageReader(signature_image),
#                     x=320,  
#                     y=170,  
#                     width=150,
#                     height=50,
#                     mask='auto'
#                 )
#                 print("Successfully drew signature")
#             except Exception as e:
#                 print("Error processing signature:", str(e))
#                 print("Error type:", type(e))

#         # signature 블록 밖으로 이동
#         can.save()
#         packet.seek(0)
        
#         new_pdf = PdfReader(packet)
#         output = PdfWriter()
#         page = template_pdf.pages[0]
#         page.merge_page(new_pdf.pages[0])
#         output.add_page(page)
        
#         # PDF를 바이트로 변환
#         output_stream = io.BytesIO()
#         output.write(output_stream)
#         pdf_value = output_stream.getvalue()
        
#         print("Uploading to S3...")
#         s3_client.put_object(
#             Bucket='bosk-pdf',  # designated bucket name
#             Key=f"work-hours-forms/{filename}",
#             Body=pdf_value,
#             ContentType='application/pdf'
#         )
        
#         s3_url = f"https://bosk-pdf.s3.amazonaws.com/work-hours-forms/{filename}"
#         print(f"S3 URL generated: {s3_url}")
        
#         return {
#             "message": "PDF saved to S3 successfully", 
#             "file_url": s3_url,
#             "form_id": form_data.id  # 생성된 ID 반환
#         }
        
#     except ClientError as e:
#         print(f"AWS S3 Error: {str(e)}")
#         raise HTTPException(status_code=500, detail=f"S3 error: {str(e)}")
#     except Exception as e:
#         print(f"Unexpected error: {str(e)}")
#         print(f"Error type: {type(e)}")
#         import traceback
#         print(f"Traceback: {traceback.format_exc()}")
#         raise HTTPException(status_code=500, detail=str(e))
