import os
import sqlalchemy as sa
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine, Base
from app.config import settings
from app.routers import auth, books, loans, forum, users, stats, book_chat, book_rag, wishlist, debate, covers, shelves, digital_copies, knowledge_hub, system, external_search, settings as settings_router, translate
from app.routers.ai_status import router as ai_status_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(
            sa.text(
                "DO $$ BEGIN "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='books' AND column_name='shelf_id') THEN "
                "ALTER TABLE books ADD COLUMN shelf_id INTEGER REFERENCES shelves(id); "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='books' AND column_name='has_digital_copy') THEN "
                "ALTER TABLE books ADD COLUMN has_digital_copy BOOLEAN DEFAULT FALSE; "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='digital_copies' AND column_name='is_default') THEN "
                "ALTER TABLE digital_copies ADD COLUMN is_default BOOLEAN DEFAULT FALSE; "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='book_chunks' AND column_name='copy_id') THEN "
                "ALTER TABLE book_chunks ADD COLUMN copy_id INTEGER REFERENCES digital_copies(id) ON DELETE CASCADE; "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='knowledge_sources' AND column_name='digital_copy_id') THEN "
                "ALTER TABLE knowledge_sources ADD COLUMN digital_copy_id INTEGER REFERENCES digital_copies(id) ON DELETE CASCADE; "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='ai_provider') THEN "
                "ALTER TABLE users ADD COLUMN ai_provider VARCHAR(20) DEFAULT 'local'; "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='ai_model') THEN "
                "ALTER TABLE users ADD COLUMN ai_model VARCHAR(100); "
                "END IF; "
                "IF NOT EXISTS (SELECT 1 FROM information_schema.columns "
                "WHERE table_name='users' AND column_name='claude_api_key_enc') THEN "
                "ALTER TABLE users ADD COLUMN claude_api_key_enc TEXT; "
                "END IF; "
                "END $$;"
            )
        )
        await conn.execute(
            sa.text(
                "UPDATE books SET is_ebook = TRUE "
                "WHERE has_digital_copy = TRUE AND is_ebook = FALSE"
            )
        )
        result = await conn.execute(
            sa.text(
                "SELECT DISTINCT shelf FROM books "
                "WHERE shelf IS NOT NULL AND shelf != '' AND shelf_id IS NULL"
            )
        )
        old_shelves = [r[0] for r in result.fetchall()]
        if old_shelves:
            admin_ids = await conn.execute(
                sa.text("SELECT id FROM users WHERE is_admin = TRUE ORDER BY id LIMIT 1")
            )
            admin_row = admin_ids.first()
            if admin_row:
                admin_id = admin_row[0]
                for name in old_shelves:
                    exists = await conn.execute(
                        sa.text("SELECT id FROM shelves WHERE user_id = :uid AND name = :nm"),
                        {"uid": admin_id, "nm": name},
                    )
                    if exists.first():
                        continue
                    max_order = await conn.execute(
                        sa.text("SELECT COALESCE(MAX(sort_order), -1) FROM shelves WHERE user_id = :uid"),
                        {"uid": admin_id},
                    )
                    next_order = (max_order.scalar() or -1) + 1
                    shelf_id = await conn.execute(
                        sa.text(
                            "INSERT INTO shelves (user_id, name, sort_order, created_at) "
                            "VALUES (:uid, :nm, :so, NOW()) RETURNING id"
                        ),
                        {"uid": admin_id, "nm": name, "so": next_order},
                    )
                    sid = shelf_id.scalar()
                    await conn.execute(
                        sa.text("UPDATE books SET shelf_id = :sid WHERE shelf = :nm AND shelf_id IS NULL"),
                        {"sid": sid, "nm": name},
                    )
    yield
    await engine.dispose()


app = FastAPI(title="Kutuphane API", version="1.0.0", lifespan=lifespan, redirect_slashes=False)

os.makedirs(settings.COVERS_DIR, exist_ok=True)
app.mount("/covers", StaticFiles(directory=settings.COVERS_DIR), name="covers")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(books.router, prefix="/api")
app.include_router(loans.router, prefix="/api")
app.include_router(forum.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(stats.router, prefix="/api")
app.include_router(book_chat.router, prefix="/api")
app.include_router(book_rag.router, prefix="/api")
app.include_router(wishlist.router, prefix="/api")
app.include_router(debate.router, prefix="/api")
app.include_router(covers.router, prefix="/api")
app.include_router(shelves.router, prefix="/api")
app.include_router(digital_copies.router, prefix="/api")
app.include_router(ai_status_router, prefix="/api")
app.include_router(knowledge_hub.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(external_search.router, prefix="/api")
app.include_router(settings_router.router, prefix="/api")
app.include_router(translate.router, prefix="/api")


@app.get("/api/health")
async def health():
    return {"status": "ok"}
