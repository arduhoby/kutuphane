from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone
from typing import List, Optional

from app.database import get_db
from app.models.loan import Loan
from app.models.book import Book
from app.models.user import User
from app.schemas.loan import LoanCreate, LoanReturn, LoanOut
from app.services.auth_service import get_current_user, get_admin_user

router = APIRouter(prefix="/loans", tags=["loans"])


@router.get("", response_model=List[LoanOut])
async def list_loans(
    active_only: bool = Query(False),
    overdue_only: bool = Query(False),
    user_id: Optional[int] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(Loan)

    if not current_user.is_admin:
        stmt = stmt.where(Loan.user_id == current_user.id)
    elif user_id:
        stmt = stmt.where(Loan.user_id == user_id)

    if active_only:
        stmt = stmt.where(Loan.returned_at.is_(None))
    if overdue_only:
        stmt = stmt.where(
            and_(Loan.returned_at.is_(None), Loan.due_at < datetime.now(timezone.utc))
        )

    stmt = stmt.offset(skip).limit(limit).order_by(Loan.borrowed_at.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=LoanOut, status_code=201)
async def create_loan(
    data: LoanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.execute(select(Book).where(Book.id == data.book_id))
    if not book.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Book not found")

    active = await db.execute(
        select(Loan).where(Loan.book_id == data.book_id, Loan.returned_at.is_(None))
    )
    if active.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Book is already on loan")

    if data.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Cannot create loan for another user")

    user_exists = await db.execute(select(User).where(User.id == data.user_id))
    if not user_exists.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="User not found")

    loan = Loan(**data.model_dump())
    db.add(loan)
    await db.commit()
    await db.refresh(loan)
    return loan


@router.post("/{loan_id}/return", response_model=LoanOut)
async def return_loan(
    loan_id: int,
    data: LoanReturn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(Loan).where(Loan.id == loan_id))
    loan = result.scalar_one_or_none()
    if not loan:
        raise HTTPException(status_code=404, detail="Loan not found")

    if loan.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    if loan.returned_at:
        raise HTTPException(status_code=400, detail="Book already returned")

    loan.returned_at = datetime.now(timezone.utc)
    if data.notes:
        loan.notes = data.notes

    await db.commit()
    await db.refresh(loan)
    return loan
