from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PurchasePlanCreate(BaseModel):
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    price: Optional[str] = None
    notes: Optional[str] = None


class PurchasePlanUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    price: Optional[str] = None


class PurchasePlanOut(BaseModel):
    id: int
    user_id: int
    title: str
    author: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    source: Optional[str] = None
    source_url: Optional[str] = None
    price: Optional[str] = None
    notes: Optional[str] = None
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}
