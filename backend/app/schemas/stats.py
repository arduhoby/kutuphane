from pydantic import BaseModel
from typing import Optional


class StatsOut(BaseModel):
    total_books: int
    total_read: int
    total_ebooks: int
    total_users: int
    active_loans: int
    overdue_loans: int
    total_topics: int
