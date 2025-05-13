# 📊 Timesheet Submission App

An internal web app for employees to submit their weekly work hours and for managers to review and approve them. Finalized forms are saved to AWS S3 and stored in RDS.

## 🔧 Tech Stack

- Frontend: React.js
- Backend: FastAPI
- Database: PostgreSQL (RDS)
- Cloud: AWS (S3, EC2)

## 🚀 Getting Started

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/project-name.git

# 2. Install backend dependencies
cd backend_api
pip install -r requirements.txt

# 3. Start the FastAPI server
cd BOSK
uvicorn backend_api.main:app --reload or make run-backend

# 4. Start the frontend
cd submission-app
npm install
npm start
```

## 📦 Project Structure

backend_api/
├── main.py # FastAPI entry point and routes
├── models.py # Pydantic models
├── utils.py # Utility functions
└── requirements.txt # Python dependencies

submission-app/
├── public # Static files
    ├── assets # Images, icons, etc.
    ├── index.html # HTML template
    └── manifest.json # PWA configuration
├── src # React components
    ├── api # API calls
    ├── assets # Images, icons, etc.
    ├── components # Reusable components
    ├── styles # Global styles
    ├── types # TypeScript types
    ├── App.js # Main App component
    ├── index.js # Entry point
├── package.json # Frontend dependencies
└── package-lock.json # Frontend dependencies

## 🔑 API Endpoints

### POST /submit-form

Submit a new timesheet form.
<!-- 
Request Body:

json
{
"employeeName": "John Doe",
"requestorName": "Jane Smith",
"requestDate": "2023-01-01",
"serviceWeek": {"start": "2023-01-01", "end": "2023-01-07"},
"schedule": [{"day": "2023-01-01", "time": "09:00-18:00", "location": "Office"}]
}

Response:

json -->
