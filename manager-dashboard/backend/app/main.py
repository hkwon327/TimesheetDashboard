# main.py
from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List, Optional

from models import ManagerSubmission, SubmissionStatus, Base
from database import engine, get_session
from schemas import SubmissionCreate, SubmissionStatusUpdate, SubmissionOut

app = FastAPI()

# (앱 실행 시) 테이블 자동 생성 (개발 단계에서 편리)
@app.on_event("startup")
async def on_startup():
    async with engine.begin() as conn:
        # 기존 테이블이 있으면 스킵하고 없을 때만 생성
        await conn.run_sync(Base.metadata.create_all)

## 1. 새 제출 데이터 등록 엔드포인트
@app.post("/api/submissions", response_model=SubmissionOut)
async def create_submission(
    submission: SubmissionCreate, session: AsyncSession = Depends(get_session)
):
    # 가장 최근 confirmed된 데이터를 조회 (업데이트 시간 기준 내림차순)
    result = await session.execute(
        select(ManagerSubmission)
        .filter(ManagerSubmission.status == SubmissionStatus.confirmed)
        .order_by(ManagerSubmission.updated_at.desc())
        .limit(1)
    )
    last_confirmed = result.scalar_one_or_none()

    # 기본 상태는 pending
    status_to_set = SubmissionStatus.pending

    # 이전 confirmed 데이터와 주요 필드(날짜 제외)를 비교
    if last_confirmed:
        if (
            last_confirmed.interpreter_name == submission.interpreter_name and
            last_confirmed.requestor_name == submission.requestor_name and
            last_confirmed.affiliated_unit == submission.affiliated_unit and
            last_confirmed.service_location == submission.service_location and
            last_confirmed.purpose == submission.purpose
        ):
            status_to_set = SubmissionStatus.approved

    new_submission = ManagerSubmission(
        interpreter_name=submission.interpreter_name,
        request_date=submission.request_date,
        requestor_name=submission.requestor_name,
        affiliated_unit=submission.affiliated_unit,
        service_location=submission.service_location,
        service_time=submission.service_time,
        purpose=submission.purpose,
        status=status_to_set,
    )
    session.add(new_submission)
    await session.commit()
    await session.refresh(new_submission)
    return new_submission

## 2. 제출 데이터 상태 업데이트 엔드포인트
@app.put("/api/submissions/{submission_id}/status", response_model=dict)
async def update_submission_status(
    submission_id: int,
    status_update: SubmissionStatusUpdate,
    session: AsyncSession = Depends(get_session),
):
    # 해당 submission을 조회
    result = await session.execute(
        select(ManagerSubmission).filter(ManagerSubmission.submission_id == submission_id)
    )
    submission_obj = result.scalar_one_or_none()
    if not submission_obj:
        raise HTTPException(status_code=404, detail="Submission not found")

    # 만약 새 상태가 confirmed라면 기존 confirmed 데이터를 archived 처리
    if status_update.status == SubmissionStatus.confirmed:
        await session.execute(
            ManagerSubmission.__table__
            .update()
            .where(ManagerSubmission.status == SubmissionStatus.confirmed)
            .values(status=SubmissionStatus.archived)
        )
    submission_obj.status = status_update.status
    await session.commit()
    return {"updated": True}

## 3. 제출 데이터 조회 엔드포인트 (상태별 필터링 가능)
@app.get("/api/submissions", response_model=List[SubmissionOut])
async def get_submissions(
    status: Optional[SubmissionStatus] = None,
    session: AsyncSession = Depends(get_session),
):
    query = select(ManagerSubmission)
    if status:
        query = query.filter(ManagerSubmission.status == status)
    result = await session.execute(query)
    submissions = result.scalars().all()
    return submissions
