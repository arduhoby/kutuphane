from fastapi import APIRouter, Depends
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timezone

from app.database import get_db
from app.models.book import Book
from app.models.loan import Loan
from app.models.user import User
from app.models.forum import ForumTopic
from app.schemas.stats import StatsOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("", response_model=StatsOut)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    total_books = await db.scalar(select(func.count(Book.id))) or 0
    total_read = await db.scalar(select(func.count(Book.id)).where(Book.is_read == True)) or 0
    total_ebooks = await db.scalar(select(func.count(Book.id)).where(Book.is_ebook == True)) or 0
    total_users = await db.scalar(select(func.count(User.id))) or 0
    active_loans = await db.scalar(
        select(func.count(Loan.id)).where(Loan.returned_at.is_(None))
    ) or 0
    overdue_loans = await db.scalar(
        select(func.count(Loan.id)).where(
            Loan.returned_at.is_(None), Loan.due_at < datetime.now(timezone.utc)
        )
    ) or 0
    total_topics = await db.scalar(select(func.count(ForumTopic.id))) or 0

    return StatsOut(
        total_books=total_books,
        total_read=total_read,
        total_ebooks=total_ebooks,
        total_users=total_users,
        active_loans=active_loans,
        overdue_loans=overdue_loans,
        total_topics=total_topics,
    )
