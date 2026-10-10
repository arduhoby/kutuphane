import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.config import settings
from app.models.book import Book
from app.models.user import User
from app.models.digital_copy import DigitalCopy
from app.services.auth_service import get_current_user
from app.services.rag_service import process_book_file, search_similar_chunks, auto_fill_rag

router = APIRouter(prefix="/books/{book_id}/rag", tags=["rag"])

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".doc", ".docx"}
UPLOAD_DIR = "/var/lib/kutuphane/rag"


class RAGSearchQuery(BaseModel):
    q: str


class RAGSearchResult(BaseModel):
    id: int
    chunk_index: int
    content: str
    distance: float


class RAGSearchResponse(BaseModel):
    results: list[RAGSearchResult]


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


@router.post("/upload")
async def upload_book_file(
    book_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    ext = _ext(file.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Sadece PDF ve EPUB dosyaları kabul edilir")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Boş dosya")

    # 1. Process for RAG (chunk + embed)
    try:
        chunk_count = await process_book_file(book_id, file.filename or f"book{ext}", content, db, user=current_user)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Dosya işlenirken hata: {str(e)}")

    # 2. Also save as DigitalCopy so it appears in copies UI
    book_dir = os.path.join(settings.EBOOKS_DIR, str(book_id))
    os.makedirs(book_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(book_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(content)

    existing_primary = await db.execute(
        select(DigitalCopy).where(
            DigitalCopy.book_id == book_id, DigitalCopy.is_primary == True
        )
    )
    is_first = existing_primary.scalar_one_or_none() is None

    copy = DigitalCopy(
        book_id=book_id,
        user_id=current_user.id,
        type="pdf" if ext == ".pdf" else "epub",
        file_path=file_path,
        original_filename=file.filename or f"book{ext}",
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        is_public=False,
        is_primary=is_first,
    )
    db.add(copy)

    await db.execute(
        Book.__table__.update().where(Book.id == book_id).values(has_digital_copy=True)
    )
    await db.commit()

    return {
        "message": f"{chunk_count} bölüm başarıyla işlendi ve indekslendi.",
        "chunk_count": chunk_count,
    }


@router.post("/auto-fill")
async def auto_fill_book_rag(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    if book.has_rag:
        return {"message": "Bu kitap için RAG zaten yüklü.", "sources": []}

    result = await auto_fill_rag(book_id, book.title, book.author, book.isbn, db)
    return result


@router.post("/search", response_model=RAGSearchResponse)
async def search_rag(
    book_id: int,
    query: RAGSearchQuery,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    if not book.has_rag:
        raise HTTPException(status_code=400, detail="Bu kitap için RAG içeriği yüklenmemiş")

    results = await search_similar_chunks(db, book_id, query.q)
    return RAGSearchResponse(
        results=[RAGSearchResult(**r) for r in results]
    )
