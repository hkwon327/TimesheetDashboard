from sqlalchemy.sql import text  # text 객체 가져오기
from database import get_session
import asyncio

async def test_connection():
    async for session in get_session():
        result = await session.execute(text("SHOW TABLES;"))  # text()로 감싸기
        tables = result.fetchall()
        print("테이블 목록:", tables)

# 실행
if __name__ == "__main__":
    asyncio.run(test_connection())
