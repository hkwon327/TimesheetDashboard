# 📊 Timesheet Submission App

An internal web app for employees to submit their weekly work hours and for managers to review and approve them. Finalized forms are saved to AWS S3 and stored in RDS.

## 🔧 Tech Stack

- Frontend: React.js
- Backend: FastAPI
- Database: PostgreSQL (RDS)
- Cloud: AWS (S3, EC2)

## 🚀 Getting Started

```bash


# 2. Install backend dependencies
cd backend_api
pip install -r requirements.txt

# 3. Start the FastAPI server
cd BOSK
make run-api 
OR
uvicorn backend_api.main:app --reload

# 4. Start the frontend
# Submission App
cd BOSK/submission-app
npm install
npm start

# Dashboard App
cd BOSK/dashboard-app
npm install
npm start
```