from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class ForumTopicCreate(BaseModel):
    title: str
    content: Optional[str] = None


class ForumTopicOut(BaseModel):
    id: int
    title: str
    content: Optional[str] = None
    user_id: int
    created_at: datetime
    updated_at: datetime
    reply_count: int = 0

    model_config = {"from_attributes": True}


class ForumReplyCreate(BaseModel):
    content: str


class ForumReplyOut(BaseModel):
    id: int
    topic_id: int
    user_id: int
    content: str
    created_at: datetime

    model_config = {"from_attributes": True}
