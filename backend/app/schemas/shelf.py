from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ShelfCreate(BaseModel):
    name: str
    color: Optional[str] = None


class ShelfUpdate(BaseModel):
    name: Optional[str] = None
    color: Optional[str] = None
    sort_order: Optional[int] = None


class ShelfOut(BaseModel):
    id: int
    user_id: int
    name: str
    color: Optional[str] = None
    sort_order: int = 0
    book_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
