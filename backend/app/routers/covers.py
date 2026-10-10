from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.book import Book
from app.models.user import User
from app.services.auth_service import get_current_user, get_admin_user
from app.services.cover_service import save_cover_from_url, get_cover_path, ALLOWED_IMAGE_EXTENSIONS

router = APIRouter(prefix="/covers", tags=["covers"])


@router.post("/upload")
async def upload_cover(
    book_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    ext = os.path.splitext(file.filename or ".jpg")[1].lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Sadece JPG, PNG, WebP ve GIF dosyaları kabul edilir")

    content = await file.read()
    filename = f"book_{book_id}{ext}"
    filepath = get_cover_path(filename)

    with open(filepath, "wb") as f:
        f.write(content)

    local_url = f"/covers/{filename}"
    book.cover_url = local_url
    await db.commit()

    return {"cover_url": local_url, "message": "Kapak yüklendi"}


@router.post("/download")
async def download_cover(
    body: dict,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book_id = body.get("book_id")
    url = body.get("url")
    if not book_id or not url:
        raise HTTPException(status_code=400, detail="book_id ve url gerekli")
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    local_url = await save_cover_from_url(book_id, url)
    if not local_url:
        raise HTTPException(status_code=400, detail="Kapak indirilemedi")

    book.cover_url = local_url
    await db.commit()

    return {"cover_url": local_url, "message": "Kapak indirildi ve kaydedildi"}


@router.post("/migrate")
async def migrate_all_covers(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    result = await db.execute(select(Book).where(Book.cover_url.isnot(None)))
    books = result.scalars().all()

    migrated = 0
    errors = []
    for book in books:
        if book.cover_url and book.cover_url.startswith("/covers/"):
            continue

        url = book.cover_url
        if url and url.startswith("http"):
            local_url = await save_cover_from_url(book.id, url)
            if local_url:
                book.cover_url = local_url
                migrated += 1
            else:
                errors.append(f"{book.id}: indirilemedi")

    await db.commit()
    return {
        "message": f"{migrated} kapak taşındı, {len(books) - migrated} zaten yerel.",
        "migrated": migrated,
        "total": len(books),
        "errors": errors[:10],
    }


@router.get("/{filename}")
async def serve_cover(filename: str):
    filepath = get_cover_path(filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Kapak bulunamadı")
    return FileResponse(filepath)
