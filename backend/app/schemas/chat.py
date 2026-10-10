from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ChatMessageCreate(BaseModel):
    content: str


class ChatMessageOut(BaseModel):
    id: int
    chat_id: int
    user_id: Optional[int] = None
    role: str
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ChatSessionOut(BaseModel):
    id: int
    book_id: int
    messages: list[ChatMessageOut] = []
    created_at: datetime

    model_config = {"from_attributes": True}
