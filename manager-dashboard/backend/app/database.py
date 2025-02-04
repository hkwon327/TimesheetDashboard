# database.py
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# MySQL 접속 정보 (본인 환경에 맞게 수정)
DATABASE_URL = "mysql+aiomysql://yourusername:yourpassword@localhost/manager_db"

engine = create_async_engine(DATABASE_URL, echo=True)

async_session = sessionmaker(
    engine, expire_on_commit=False, class_=AsyncSession
)

# 의존성 주입 함수: 각 요청마다 세션을 생성
async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
