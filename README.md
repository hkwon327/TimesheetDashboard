# 📊 Timesheet Submission & Dashboard Portal

An internal web application for employees to submit their weekly work hours and for managers to review, approve, and track them.  
Finalized forms are **stored in AWS RDS** (structured data) and archived as **PDFs in AWS S3**.

---

## Features

- **Timesheet App**: Employees enter weekly timesheets
- **Dashboard App**: Managers review & approve submissions
- **Storage**:  
  - PDF → AWS S3  
  - Structured data → PostgreSQL (RDS)
- **Cloud Infra**: AWS S3, Lambda, API Gateway CloudFront, Route53, ACM, RDS
---

## Tech Stack

**Frontend**
- React.js (CRA) with CSS

**Backend**
- FastAPI (Python 3.9+)  
- Uvicorn for local dev  
- SQLAlchemy + psycopg2  

**Database**
- PostgreSQL (AWS RDS)

**Cloud / Infra**
- AWS S3 (static hosting & PDFs)  
- AWS Lambda + API Gateway
- AWS CloudFront (CDN)  
- AWS Route53 + ACM (HTTPS)  


