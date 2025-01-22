from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
from typing import List
import uvicorn

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
app = FastAPI()

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For testing, allow all origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "API is running"}

class ScheduleItem(BaseModel):
    day: str
    date: str
    time: str = ""  # Default empty string for optional fields
    location: str = ""

class NameInput(BaseModel):
    employeeName: str = ""
    requestorName: str = ""
    requestDate: str = ""
    serviceWeek: str
    schedule: List[ScheduleItem]
    signature: str = ""

@app.post("/generate-pdf")
async def generate_pdf(name_input: NameInput):
    try:
        logger.info("Processing PDF generation request...")
        
        if not os.path.exists("Form.pdf"):
            logger.error("Form.pdf not found")
            raise HTTPException(status_code=404, detail="Template PDF not found")
        
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        
        # Draw header information
        can.drawString(250, 605, name_input.employeeName)
        can.drawString(250, 415, name_input.requestorName)
        can.drawString(250, 395, name_input.requestDate)
        can.drawString(250, 375, name_input.serviceWeek)
        
        # Draw schedule table
        y_position = 355
        for schedule_item in name_input.schedule:
            if schedule_item.time or schedule_item.location:  # Only draw if there's time or location
                schedule_text = f"{schedule_item.day} ({schedule_item.date})"
                can.drawString(100, y_position, schedule_text)
                
                # Draw time and location if they exist
                if schedule_item.time:
                    can.drawString(250, y_position, schedule_item.time)
                if schedule_item.location:
                    can.drawString(450, y_position, schedule_item.location)
                
                y_position -= 10  # Space between lines
        
        # Process signature if exists
        if name_input.signature and name_input.signature.startswith('data:image'):
            try:
                # Extract and decode signature
                signature_data = name_input.signature.split(',')[1]
                signature_bytes = base64.b64decode(signature_data)
                
                # Create image and convert to RGBA for transparency
                signature_image = Image.open(io.BytesIO(signature_bytes))
                signature_image = signature_image.convert('RGBA')
                
                # Convert black background to transparent
                datas = signature_image.getdata()
                newData = []
                for item in datas:
                    # Change all white (also shades of whites) pixels to transparent
                    if item[0] >= 200 and item[1] >= 200 and item[2] >= 200:
                        newData.append((255, 255, 255, 0))
                    else:
                        newData.append(item)
                
                signature_image.putdata(newData)
                
                # Save temporary file with transparency
                temp_file_path = "temp_signature.png"
                signature_image.save(temp_file_path, "PNG")
                
                # Draw signature on PDF
                can.drawImage(temp_file_path, 400, 500, width=200, height=100, mask='auto')
                
                # Clean up temp file
                os.remove(temp_file_path)
                
                logger.info("Added signature to PDF")
            except Exception as e:
                logger.error(f"Error processing signature: {str(e)}")
                logger.info("Continuing without signature")
        
        can.save()
        packet.seek(0)
        
        # Create PDF with signature
        existing_pdf = PdfReader("Form.pdf")
        output = PdfWriter()
        
        page = existing_pdf.pages[0]
        overlay = PdfReader(packet)
        page.merge_page(overlay.pages[0])
        output.add_page(page)
        
        # Save to memory
        output_stream = io.BytesIO()
        output.write(output_stream)
        output_stream.seek(0)
        
        return Response(
            content=output_stream.getvalue(),
            media_type="application/pdf",
            headers={
                "Content-Disposition": "inline; filename=modified.pdf",
                "Access-Control-Allow-Origin": "http://bosk-frontend.s3-website-us-east-1.amazonaws.com",
                "Access-Control-Expose-Headers": "Content-Disposition"
            }
        )
        
    except Exception as e:
        logger.error(f"Error in generate_pdf: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    uvicorn.run("main:app", 
                host="0.0.0.0",
                port=8000,
                reload=False)  # Set to False in production
