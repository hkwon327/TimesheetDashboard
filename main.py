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

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)
app = FastAPI()

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://bosk-frontend.s3-website-us-east-1.amazonaws.com",
        "http://localhost:3000"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    return {"message": "API is running"}

class NameInput(BaseModel):
    employeeName: str
    requestorName: str
    requestDate: str

@app.post("/generate-pdf")
async def generate_pdf(name_input: NameInput):
    try:
        logger.info(f"Received request with data: {name_input}")
        
        # Add error handling for file existence
        if not os.path.exists("Form.pdf"):
            logger.error("Form.pdf not found")
            raise HTTPException(status_code=404, detail="Template PDF not found")
        
        packet = io.BytesIO()
        can = canvas.Canvas(packet, pagesize=letter)
        
        # Employee Name
        can.drawString(250, 435, name_input.employeeName)
        
        # Requestor Name
        can.drawString(250, 415, name_input.requestorName)
        
        # Request Date
        can.drawString(250, 395, name_input.requestDate)
        
        can.save()
        
        packet.seek(0)
        
        # Open the PDF with error handling
        try:
            with open("Form.pdf", "rb") as pdf_file:
                existing_pdf = PdfReader(pdf_file)
                output = PdfWriter()
                
                page = existing_pdf.pages[0]
                overlay = PdfReader(packet)
                page.merge_page(overlay.pages[0])
                output.add_page(page)
                
                output_stream = io.BytesIO()
                output.write(output_stream)
                output_stream.seek(0)
                
                logger.info("PDF generated successfully")
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
            logger.error(f"Error processing PDF: {e}")
            raise HTTPException(status_code=500, detail="Error processing PDF")

    except Exception as e:
        logger.error(f"Error in modify_pdf: {e}")
        raise HTTPException(status_code=500, detail=str(e))
