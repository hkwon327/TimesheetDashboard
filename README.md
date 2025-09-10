# 📊 Timesheet Submission & Dashboard App

An internal web application for employees to submit their weekly work hours and for managers to review, approve, and track them.  
Finalized forms are **stored in AWS RDS** (structured data) and archived as **PDFs in AWS S3**.

---

## ✨ Features

- 📝 **Submission App**: Employees enter weekly timesheets
- 📊 **Dashboard App**: Managers review & approve submissions
- 📂 **Storage**:  
  - PDF → AWS S3  
  - Structured data → PostgreSQL (RDS)
- ☁️ **Cloud Infra**: AWS S3, EC2, RDS, CloudFront, Route53, ACM
- 🔒 **Secure by default**: HTTPS via ACM, ALB routing

---

## 🔧 Tech Stack

**Frontend**
- React.js (CRA)  
- React Router v6  
- Tailwind + Custom CSS  

**Backend**
- FastAPI (Python 3.9+)  
- Uvicorn for local dev  
- SQLAlchemy + psycopg2  

**Database**
- PostgreSQL (AWS RDS)

**Cloud / Infra**
- AWS S3 (static hosting & PDFs)  
- AWS EC2 (backend API)  
- AWS CloudFront (CDN)  
- AWS Route53 + ACM (HTTPS)  
- Docker (containerization)  


