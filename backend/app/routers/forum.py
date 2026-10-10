from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from app.database import get_db
from app.models.forum import ForumTopic, ForumReply
from app.models.user import User
from app.schemas.forum import ForumTopicCreate, ForumTopicOut, ForumReplyCreate, ForumReplyOut
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/forum", tags=["forum"])


@router.get("/topics", response_model=List[ForumTopicOut])
async def list_topics(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(
            ForumTopic,
            func.count(ForumReply.id).label("reply_count"),
        )
        .outerjoin(ForumReply, ForumReply.topic_id == ForumTopic.id)
        .group_by(ForumTopic.id)
        .offset(skip)
        .limit(limit)
        .order_by(ForumTopic.created_at.desc())
    )
    topics = []
    for row in result:
        topic = ForumTopicOut.model_validate(row.ForumTopic)
        topic.reply_count = row.reply_count
        topics.append(topic)
    return topics


@router.post("/topics", response_model=ForumTopicOut, status_code=201)
async def create_topic(
    data: ForumTopicCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = ForumTopic(**data.model_dump(), user_id=current_user.id)
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.get("/topics/{topic_id}", response_model=ForumTopicOut)
async def get_topic(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ForumTopic).where(ForumTopic.id == topic_id)
    )
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    return topic


@router.delete("/topics/{topic_id}", status_code=204)
async def delete_topic(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ForumTopic).where(ForumTopic.id == topic_id))
    topic = result.scalar_one_or_none()
    if not topic:
        raise HTTPException(status_code=404, detail="Topic not found")
    if topic.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(topic)
    await db.commit()


@router.get("/topics/{topic_id}/replies", response_model=List[ForumReplyOut])
async def list_replies(
    topic_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ForumReply)
        .where(ForumReply.topic_id == topic_id)
        .order_by(ForumReply.created_at)
    )
    return result.scalars().all()


@router.post("/topics/{topic_id}/replies", response_model=ForumReplyOut, status_code=201)
async def create_reply(
    topic_id: int,
    data: ForumReplyCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    topic = await db.execute(select(ForumTopic).where(ForumTopic.id == topic_id))
    if not topic.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Topic not found")

    reply = ForumReply(topic_id=topic_id, user_id=current_user.id, content=data.content)
    db.add(reply)
    await db.commit()
    await db.refresh(reply)
    return reply


@router.delete("/replies/{reply_id}", status_code=204)
async def delete_reply(
    reply_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(select(ForumReply).where(ForumReply.id == reply_id))
    reply = result.scalar_one_or_none()
    if not reply:
        raise HTTPException(status_code=404, detail="Reply not found")
    if reply.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(reply)
    await db.commit()
