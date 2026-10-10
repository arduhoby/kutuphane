import asyncio
from sqlalchemy import text
from app.database import engine
from app.models.book import Base

async def migrate():
    # Create tables (will create book_shelves if it doesn't exist)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Migrate data
    async with engine.begin() as conn:
        print("Migrating shelf_id data to book_shelves...")
        try:
            query = text("""
                INSERT INTO book_shelves (book_id, shelf_id)
                SELECT id, shelf_id FROM books WHERE shelf_id IS NOT NULL
                ON CONFLICT (book_id, shelf_id) DO NOTHING;
            """)
            result = await conn.execute(query)
            print(f"Migrated {result.rowcount} rows into book_shelves.")
        except Exception as e:
            print(f"Error migrating: {e}")

if __name__ == "__main__":
    asyncio.run(migrate())
