from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.models.shelf import Shelf
from app.models.book import Book
from app.schemas.shelf import ShelfCreate, ShelfUpdate, ShelfOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/shelves", tags=["shelves"])


@router.get("", response_model=list[ShelfOut])
async def list_shelves(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = (
        select(
            Shelf.id,
            Shelf.user_id,
            Shelf.name,
            Shelf.color,
            Shelf.sort_order,
            Shelf.created_at,
            func.count(Book.id).label("book_count"),
        )
        .outerjoin(Book, Book.shelf_id == Shelf.id)
        .where(Shelf.user_id == current_user.id)
        .group_by(Shelf.id)
        .order_by(Shelf.sort_order, Shelf.name)
    )
    result = await db.execute(stmt)
    rows = result.all()
    return [
        ShelfOut(
            id=r.id,
            user_id=r.user_id,
            name=r.name,
            color=r.color,
            sort_order=r.sort_order,
            book_count=r.book_count,
            created_at=r.created_at,
        )
        for r in rows
    ]


@router.post("", response_model=ShelfOut, status_code=201)
async def create_shelf(
    data: ShelfCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(Shelf).where(
            Shelf.user_id == current_user.id,
            Shelf.name == data.name,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Bu isimde bir raf zaten var")

    max_order = await db.scalar(
        select(func.coalesce(func.max(Shelf.sort_order), -1)).where(
            Shelf.user_id == current_user.id
        )
    )
    shelf = Shelf(
        user_id=current_user.id,
        name=data.name,
        color=data.color,
        sort_order=(max_order or -1) + 1,
    )
    db.add(shelf)
    await db.commit()
    await db.refresh(shelf)

    count = await db.scalar(
        select(func.count(Book.id)).where(Book.shelf_id == shelf.id)
    )
    return ShelfOut(
        id=shelf.id,
        user_id=shelf.user_id,
        name=shelf.name,
        color=shelf.color,
        sort_order=shelf.sort_order,
        book_count=count or 0,
        created_at=shelf.created_at,
    )


@router.put("/{shelf_id}", response_model=ShelfOut)
async def update_shelf(
    shelf_id: int,
    data: ShelfUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Shelf).where(Shelf.id == shelf_id, Shelf.user_id == current_user.id)
    )
    shelf = result.scalar_one_or_none()
    if not shelf:
        raise HTTPException(status_code=404, detail="Raf bulunamadı")

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(shelf, key, val)

    await db.commit()
    await db.refresh(shelf)

    count = await db.scalar(
        select(func.count(Book.id)).where(Book.shelf_id == shelf.id)
    )
    return ShelfOut(
        id=shelf.id,
        user_id=shelf.user_id,
        name=shelf.name,
        color=shelf.color,
        sort_order=shelf.sort_order,
        book_count=count or 0,
        created_at=shelf.created_at,
    )


@router.delete("/{shelf_id}", status_code=204)
async def delete_shelf(
    shelf_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Shelf).where(Shelf.id == shelf_id, Shelf.user_id == current_user.id)
    )
    shelf = result.scalar_one_or_none()
    if not shelf:
        raise HTTPException(status_code=404, detail="Raf bulunamadı")

    await db.execute(
        Book.__table__.update().where(Book.shelf_id == shelf_id).values(shelf_id=None)
    )
    await db.delete(shelf)
    await db.commit()
