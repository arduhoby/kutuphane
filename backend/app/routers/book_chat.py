from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import asyncio
from app.database import get_db
from app.models.book import Book
from app.models.book_chat import BookChat, ChatMessage
from app.models.user import User
from app.schemas.chat import ChatMessageCreate, ChatMessageOut, ChatSessionOut
from app.services.auth_service import get_current_user
from app.services.llm_service import ask_llm, build_prompt
from app.services.web_search_service import search_web, format_search_context

router = APIRouter(prefix="/books/{book_id}/chat", tags=["chat"])


async def get_or_create_chat(book_id: int, db: AsyncSession) -> BookChat:
    result = await db.execute(select(BookChat).where(BookChat.book_id == book_id))
    chat = result.scalar_one_or_none()
    if not chat:
        chat = BookChat(book_id=book_id)
        db.add(chat)
        await db.commit()
        await db.refresh(chat)
    return chat


@router.get("", response_model=ChatSessionOut)
async def get_chat_session(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    chat = await get_or_create_chat(book_id, db)
    result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.chat_id == chat.id)
        .order_by(ChatMessage.created_at)
    )
    messages = result.scalars().all()
    return ChatSessionOut(id=chat.id, book_id=book_id, messages=messages, created_at=chat.created_at)


@router.post("", response_model=ChatMessageOut)
async def send_chat_message(
    book_id: int,
    data: ChatMessageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")

    chat = await get_or_create_chat(book_id, db)

    user_msg = ChatMessage(
        chat_id=chat.id,
        user_id=current_user.id,
        role="user",
        content=data.content,
    )
    db.add(user_msg)
    await db.commit()
    await db.refresh(user_msg)

    try:
        web_query = f"{book.title} {book.author or ''} kitap"
        if data.content:
            web_query += f" {data.content}"
        search_results = await search_web(web_query, max_results=5)
        web_context = format_search_context(search_results)
    except Exception:
        web_context = ""

    try:
        prompt = build_prompt(book.title, book.author, data.content, web_context)
        ai_response = await ask_llm(prompt, user=current_user)
    except Exception as e:
        ai_response = f"Üzgünüm, şu anda yanıt veremiyorum. Lütfen daha sonra tekrar dene."

    ai_msg = ChatMessage(
        chat_id=chat.id,
        user_id=None,
        role="assistant",
        content=ai_response,
    )
    db.add(ai_msg)
    await db.commit()
    await db.refresh(ai_msg)

    return ai_msg
