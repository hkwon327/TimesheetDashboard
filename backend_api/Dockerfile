FROM python:3.9-slim

WORKDIR /app

# requirements.txt 복사 및 설치
COPY requirements.txt .
RUN pip install -r requirements.txt

# backend_api 폴더 내용만 복사
COPY . .

EXPOSE 8000
# 루트에서 실행하던 명령어를 컨테이너 내부에서 실행
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]