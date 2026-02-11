# Timesheet Submission & Dashboard Portal

Web applications for submitting and managing work hours.

🔗 Live  
- Timesheet: https://timesheet.blueoilsk.com  
- Dashboard: https://dashboard.blueoilsk.com  

---

## Overview

This project was built as a personal project inspired by a real-world workflow observed at an industrial construction site where I worked as a part-time interpreter.

Work hours were previously recorded on paper and shared manually.  
This motivated the creation of web applications that transform the paper-based process into a digital workflow.

The project consists of two applications:
- **Timesheet App** – for submitting work hours
- **Dashboard App** – for reviewing and managing submissions

---

## Impact
Transformed a fully paper-based timesheet system at an industrial construction site into an automated digital workflow, improving operational efficiency and accessibility.
- Achieved a 90% reduction in processing time by automating submissions and eliminating manual photo reporting
- Digitized reporting workflows, removing paper waste and reducing administrative overhead
- Enabled remote, mobile-friendly submissions for off-site employees
- Delivered real-time managerial visibility into workforce data through centralized dashboards
- Streamlined tracking of hours and attendance, reducing reporting errors and delays

---

## Features

### Timesheet App
- Submit work hours
- Preview before submission
- Basic validation

### Dashboard App
- View submissions
- Approve or reject entries
- Filter by status

---

## Tech Stack
## Tech Stack

**Frontend**
- React (Create React App)
- Axios

**Backend**
- AWS Lambda (Python)
- API Gateway
- RDS (PostgreSQL)

**Infrastructure**
- S3
- CloudFront
- Route53
- ACM (TLS)
- GitHub Actions (CI/CD)

---

## CI/CD

On each push to the `main` branch:
- Both frontend apps are built
- Build files are uploaded to S3
- CloudFront cache is invalidated automatically

Authentication is handled using GitHub Actions OIDC (no static AWS access keys).
