import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings

async def main():
    engine = create_async_engine(settings.DATABASE_URL)
    async with engine.begin() as conn:
        try:
            print("Adding ai_summary column to books table...")
            await conn.execute(text("ALTER TABLE books ADD COLUMN ai_summary TEXT;"))
            print("Column added successfully.")
        except Exception as e:
            if "already exists" in str(e):
                print("Column ai_summary already exists.")
            else:
                print(f"Error: {e}")
    
    await engine.dispose()

if __name__ == "__main__":
    asyncio.run(main())
