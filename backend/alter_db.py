import asyncio
from sqlalchemy import text
from app.database import engine

async def alter_db():
    async with engine.begin() as conn:
        print("Checking if is_public column exists...")
        try:
            # Try to select the column to see if it exists
            await conn.execute(text("SELECT is_public FROM knowledge_sessions LIMIT 1"))
            print("Column 'is_public' already exists.")
        except Exception:
            print("Column 'is_public' not found. Adding it...")
            # If it fails, the column likely doesn't exist. Add it.
            try:
                await conn.execute(text("ALTER TABLE knowledge_sessions ADD COLUMN is_public BOOLEAN NOT NULL DEFAULT FALSE;"))
                print("Successfully added 'is_public' column.")
            except Exception as e:
                print(f"Failed to add column: {e}")

if __name__ == "__main__":
    asyncio.run(alter_db())
