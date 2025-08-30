# BOSK/Dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential libpq-dev gcc \
  && rm -rf /var/lib/apt/lists/*

# requirements는 backend_api 폴더 것 사용
COPY backend_api/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# 레포 전체를 복사해서 backend_api, db, templates 등을 모두 포함
COPY . .

# 패키지 임포트용
ENV PYTHONPATH=/app

EXPOSE 8000
CMD ["uvicorn", "backend_api.main:app", "--host", "0.0.0.0", "--port", "8000"]
