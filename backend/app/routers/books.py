from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List

from app.database import get_db
from app.models.book import Book
from app.models.user import User
from app.models.loan import Loan
from app.models.shelf import Shelf
from app.schemas.book import BookCreate, BookUpdate, BookOut, BookListResponse
from app.services.auth_service import get_current_user
from app.services.isbn_service import lookup_isbn
from app.services.book_search_service import search_books
from app.services.web_search_service import search_web
from app.schemas.search import BookSearchResult
from app.services.cover_service import save_cover_from_url

router = APIRouter(prefix="/books", tags=["books"])


def _enrich_book(book: Book) -> Book:
    """Set shelf_name/shelf_color attributes for BookOut serialization."""
    if hasattr(book, 'shelves') and book.shelves:
        book.shelf_name = ", ".join(s.name for s in book.shelves)
        book.shelf_color = book.shelves[0].color
    else:
        book.shelf_name = book.shelf_obj.name if getattr(book, 'shelf_obj', None) else None
        book.shelf_color = book.shelf_obj.color if getattr(book, 'shelf_obj', None) else None
    return book


@router.get("", response_model=BookListResponse)
async def list_books(
    query: Optional[str] = Query(None),
    author: Optional[str] = Query(None),
    shelf: Optional[str] = Query(None),
    shelf_id: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    is_read: Optional[bool] = Query(None),
    is_ebook: Optional[bool] = Query(None),
    is_printed: Optional[bool] = Query(None),
    is_loaned: Optional[bool] = Query(None),
    sort: Optional[str] = Query("created_desc"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Book)

    if query:
        stmt = stmt.where(
            or_(
                Book.title.ilike(f"%{query}%"),
                Book.author.ilike(f"%{query}%"),
                Book.isbn.ilike(f"%{query}%"),
            )
        )
    if author:
        stmt = stmt.where(Book.author.ilike(f"%{author}%"))
    if shelf:
        stmt = stmt.where(Book.shelf == shelf)
    if shelf_id is not None:
        stmt = stmt.where(Book.shelves.any(Shelf.id == shelf_id))
    if category:
        stmt = stmt.where(Book.category == category)
    if is_read is not None:
        stmt = stmt.where(Book.is_read == is_read)
    if is_ebook is not None:
        stmt = stmt.where(Book.is_ebook == is_ebook)
    if is_printed is not None:
        if is_printed:
            stmt = stmt.where(Book.shelves.any())
        else:
            stmt = stmt.where(~Book.shelves.any())
    if is_loaned is not None:
        subq = select(Loan.book_id).where(Loan.returned_at.is_(None)).subquery()
        if is_loaned:
            stmt = stmt.where(Book.id.in_(subq))
        else:
            stmt = stmt.where(~Book.id.in_(subq))

    count_stmt = select(func.count()).select_from(stmt.subquery())
    total = await db.scalar(count_stmt) or 0

    sort_map = {
        "title_asc": Book.title.asc(),
        "title_desc": Book.title.desc(),
        "created_asc": Book.created_at.asc(),
        "created_desc": Book.created_at.desc(),
    }
    order = sort_map.get(sort, Book.created_at.desc())

    stmt = stmt.offset(skip).limit(limit).order_by(order)
    result = await db.execute(stmt)
    items = result.scalars().all()

    for book in items:
        _enrich_book(book)

    return BookListResponse(items=items, total=total, skip=skip, limit=limit)


@router.get("/{book_id}", response_model=BookOut)
async def get_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
    return _enrich_book(book)


@router.post("", response_model=BookOut, status_code=201)
async def create_book(
    data: BookCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book_data = data.model_dump()
    shelf_ids = book_data.pop("shelf_ids", []) or []
    external_cover_url = book_data.pop("external_cover_url", None)
    
    # If frontend sends external_cover_url, use it as cover_url temporarily so it gets downloaded
    if external_cover_url and not book_data.get("cover_url"):
        book_data["cover_url"] = external_cover_url
        
    # Auto-set is_ebook if digital link is provided
    if book_data.get("epub_url") or book_data.get("pdf_url"):
        book_data["is_ebook"] = True
    
    book = Book(**book_data, added_by=current_user.id)
    
    if shelf_ids:
        shelves_result = await db.execute(select(Shelf).where(Shelf.id.in_(shelf_ids)))
        book.shelves = shelves_result.scalars().all()
        # Auto-set is_ebook if any shelf name implies it's an e-book
        for s in book.shelves:
            if s.name.lower().replace("-", "").replace(" ", "") in ["ekitap", "ebook", "dijital", "dijitalkitap"]:
                book.is_ebook = True
                break
        
    db.add(book)
    await db.flush()
    if book.cover_url and book.cover_url.startswith("http"):
        local_url = await save_cover_from_url(book.id, book.cover_url)
        if local_url:
            book.cover_url = local_url
    await db.commit()
    await db.refresh(book)
    return _enrich_book(book)


@router.put("/{book_id}", response_model=BookOut)
async def update_book(
    book_id: int,
    data: BookUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    # Get raw request data
    raw_data = await request.json()

    # Handle shelves specifically
    if "shelf_ids" in raw_data:
        shelf_ids = raw_data.pop("shelf_ids") or []
        shelves_result = await db.execute(select(Shelf).where(Shelf.id.in_(shelf_ids)))
        book.shelves = shelves_result.scalars().all()
        
        # Auto-set is_ebook if any shelf name implies it's an e-book
        for s in book.shelves:
            if s.name.lower().replace("-", "").replace(" ", "") in ["ekitap", "ebook", "dijital", "dijitalkitap"]:
                book.is_ebook = True
                break

    # Update book with raw data to preserve all fields, but ignore relationships and dynamic properties
    ignored_keys = {"id", "shelf_obj", "shelf_name", "shelf_color", "created_at", "updated_at", "added_by", "shelves"}
    for key, val in raw_data.items():
        if key not in ignored_keys and hasattr(book, key) and val is not None:
            setattr(book, key, val)
            
    # Auto-set is_ebook if digital link is provided
    if book.epub_url or book.pdf_url:
        book.is_ebook = True

    if book.cover_url and book.cover_url.startswith("http"):
        local_url = await save_cover_from_url(book.id, book.cover_url)
        if local_url:
            book.cover_url = local_url

    await db.commit()
    await db.refresh(book)
    return _enrich_book(book)


@router.delete("/{book_id}", status_code=204)
async def delete_book(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Book).where(Book.id == book_id))
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    loan = await db.execute(select(Loan).where(Loan.book_id == book_id, Loan.returned_at.is_(None)))
    if loan.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Cannot delete a book that is currently on loan")

    await db.delete(book)
    await db.commit()


@router.get("/lookup/isbn")
async def lookup_book_by_isbn(
    isbn: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    info = await lookup_isbn(isbn)
    if not info:
        raise HTTPException(status_code=404, detail="Book not found via ISBN")
    return info


@router.get("/search/remote", response_model=List[BookSearchResult])
async def search_remote_books(
    q: str = Query(...),
    limit: int = Query(8, ge=1, le=20),
    current_user: User = Depends(get_current_user),
):
    results = await search_books(q, limit)
    return results


@router.get("/search/web")
async def search_web_books(
    q: str = Query(...),
    current_user: User = Depends(get_current_user),
):
    results = await search_web(f"{q} kitap satın al fiyat", max_results=8)
    return results


@router.get("/stats/overview")
async def book_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total = await db.scalar(select(func.count(Book.id)))
    read = await db.scalar(select(func.count(Book.id)).where(Book.is_read == True))
    ebooks = await db.scalar(select(func.count(Book.id)).where(Book.is_ebook == True))
    active_loans = await db.scalar(select(func.count(Loan.id)).where(Loan.returned_at.is_(None)))

    return {
        "total_books": total or 0,
        "total_read": read or 0,
        "total_ebooks": ebooks or 0,
        "active_loans": active_loans or 0,
    }
