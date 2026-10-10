"""
SQLite veritabanindaki mevcut veriyi PostgreSQL'e tasir.
Kullanim: python migrate_data.py
"""

import sqlite3
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy import text

SQLITE_PATH = "../kutuphane.db"
PG_URL = "postgresql+asyncpg://kutuphane:kutuphane@localhost:5432/kutuphane"


async def migrate():
    sqlite_conn = sqlite3.connect(SQLITE_PATH)
    sqlite_conn.row_factory = sqlite3.Row
    sqlite_cursor = sqlite_conn.cursor()

    engine = create_async_engine(PG_URL, echo=False)
    async_session = async_sessionmaker(engine)

    # Get all books from SQLite
    sqlite_cursor.execute("SELECT * FROM kitaplar")
    rows = sqlite_cursor.fetchall()

    if not rows:
        print("No data found in SQLite database.")
        return

    async with async_session() as session:
        for row in rows:
            d = dict(row)
            await session.execute(
                text("""
                    INSERT INTO books (title, author, publisher, isbn, page_count, language,
                                       publication_year, shelf, tags, notes, is_read, is_ebook)
                    VALUES (:title, :author, :publisher, :isbn, :page_count, :language,
                            :publication_year, :shelf, :tags, :notes, :is_read, :is_ebook)
                """),
                {
                    "title": d.get("ad", ""),
                    "author": d.get("yazar"),
                    "publisher": d.get("yayin_evi"),
                    "isbn": d.get("isbn"),
                    "page_count": d.get("sayfa_sayisi"),
                    "language": d.get("dil"),
                    "publication_year": d.get("basimYili"),
                    "shelf": d.get("raf"),
                    "tags": d.get("etiket"),
                    "notes": d.get("note"),
                    "is_read": bool(d.get("okundu", 0)),
                    "is_ebook": bool(d.get("ekitap", 0)),
                },
            )
        await session.commit()

    print(f"Successfully migrated {len(rows)} books from SQLite to PostgreSQL.")

    sqlite_conn.close()
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(migrate())
