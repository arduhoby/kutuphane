from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class LoanCreate(BaseModel):
    book_id: int
    user_id: int
    due_at: datetime
    notes: Optional[str] = None


class LoanReturn(BaseModel):
    notes: Optional[str] = None


class LoanOut(BaseModel):
    id: int
    book_id: int
    user_id: int
    borrowed_at: datetime
    due_at: datetime
    returned_at: Optional[datetime] = None
    notes: Optional[str] = None

    model_config = {"from_attributes": True}
