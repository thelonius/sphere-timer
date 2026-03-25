import asyncio
from sqlalchemy import text
from app.database import engine

async def migrate():
    async with engine.begin() as conn:
        print("Migrating tasks table...")
        await conn.execute(text("ALTER TABLE tasks ALTER COLUMN name TYPE VARCHAR(500);"))
        print("Done.")

if __name__ == "__main__":
    asyncio.run(migrate())
