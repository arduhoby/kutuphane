from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from app.database import get_db
from app.models.purchase_plan import PurchasePlan
from app.models.user import User
from app.schemas.purchase import PurchasePlanCreate, PurchasePlanUpdate, PurchasePlanOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/wishlist", tags=["wishlist"])


@router.get("", response_model=List[PurchasePlanOut])
async def list_wishlist(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PurchasePlan)
        .where(PurchasePlan.user_id == current_user.id)
        .order_by(PurchasePlan.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=PurchasePlanOut)
async def add_to_wishlist(
    data: PurchasePlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = PurchasePlan(
        user_id=current_user.id,
        title=data.title,
        author=data.author,
        isbn=data.isbn,
        cover_url=data.cover_url,
        source=data.source,
        source_url=data.source_url,
        price=data.price,
        notes=data.notes,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.put("/{item_id}", response_model=PurchasePlanOut)
async def update_wishlist_item(
    item_id: int,
    data: PurchasePlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PurchasePlan).where(
            PurchasePlan.id == item_id,
            PurchasePlan.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    update_data = data.model_dump(exclude_unset=True)
    for key, val in update_data.items():
        setattr(item, key, val)

    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}")
async def remove_from_wishlist(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(PurchasePlan).where(
            PurchasePlan.id == item_id,
            PurchasePlan.user_id == current_user.id,
        )
    )
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    await db.delete(item)
    await db.commit()
    return {"message": "Silindi"}
