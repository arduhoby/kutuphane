import asyncio
from app.database import engine, Base
import app.models  # this will import all models from __init__

async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Database schema updated with new models.")

if __name__ == "__main__":
    asyncio.run(init_db())
