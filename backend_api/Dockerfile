FROM python:3.11-slim

WORKDIR /app

# 시스템 패키지 설치 (Postgres client 등 필요 시)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
  && rm -rf /var/lib/apt/lists/*

# requirements.txt 복사 & 설치
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# backend_api 코드만 복사
COPY . .

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
