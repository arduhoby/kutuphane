from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DigitalCopyOut(BaseModel):
    id: int
    book_id: int
    user_id: int
    type: str
    original_filename: Optional[str] = None
    file_size: Optional[int] = None
    mime_type: Optional[str] = None
    is_public: bool = False
    is_primary: bool = False
    is_default: bool = False
    description: Optional[str] = None
    rag_status: str = "skipped"
    created_at: datetime

    model_config = {"from_attributes": True}


class DigitalCopyUpdate(BaseModel):
    type: Optional[str] = None
    description: Optional[str] = None
    is_public: Optional[bool] = None
    is_primary: Optional[bool] = None
    is_default: Optional[bool] = None
