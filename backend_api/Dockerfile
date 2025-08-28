# backend_api/Dockerfile
FROM python:3.9-slim

WORKDIR /app

# (psycopg2 쓰면 빌드 툴 필요. psycopg2-binary 쓰는 경우 이 블록은 생략 가능)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
  && rm -rf /var/lib/apt/lists/*

# requirements는 backend_api 폴더 안에 있다고 가정
COPY backend_api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 코드 복사: backend_api/ 와 db/ 둘 다
COPY backend_api /app/backend_api
COPY db          /app/db

# PYTHONPATH 추가(안전)
ENV PYTHONPATH=/app

EXPOSE 8000

# main.py가 backend_api 안에 있으니 모듈 경로로 실행
CMD ["uvicorn", "backend_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
