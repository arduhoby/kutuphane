import os
import re
import uuid
import random
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel

from app.database import get_db
from app.models.book import Book
from app.models.user import User
from app.models.digital_copy import DigitalCopy
from app.schemas.book import BookOut
from app.services.auth_service import get_current_user
from app.services.llm_service import ask_llm
from app.services.rag_service import search_similar_chunks, extract_text_pdf, extract_text_epub
from app.services.web_search_service import search_web, format_search_context

router = APIRouter(prefix="/debate", tags=["debate"])


class DebateStart(BaseModel):
    book_id: int
    side: str

class DebateStartSession(BaseModel):
    session_id: int
    side: str



class DebateStartCustom(BaseModel):
    book_title: str
    author: str = ""
    side: str


class DebateMessage(BaseModel):
    session_id: str
    content: str


class DebateResponse(BaseModel):
    session_id: str
    motion: str
    side: str
    ai_side: str
    messages: List[dict]
    winner: Optional[str] = None


MOTION_TEMPLATES = [
    "Bu ev, kitabın ana karakterinin kararlarının haklı olduğunu savunur.",
    "Bu ev, kitabın günümüzde hala geçerli bir mesajı olduğunu savunur.",
    "Bu ev, kitabın edebi değerinin abartıldığını savunur.",
    "Bu ev, kitabın toplumsal eleştirisinin doğru olduğunu savunur.",
    "Bu ev, kitabın sonunun tatmin edici olduğunu savunur.",
    "Bu ev, kitabın yazarının bakış açısının nesnel olduğunu savunur.",
    "Bu ev, kitabın karakterlerinin gerçekçi olduğunu savunur.",
    "Bu ev, kitabın okunması gereken temel eserlerden olduğunu savunur.",
]

debate_sessions: dict = {}


def generate_motion(book_title: str) -> str:
    base = random.choice(MOTION_TEMPLATES)
    return f'"{book_title}" üzerine: {base}'


def get_opposing_side(side: str) -> str:
    return "aleyhte" if side == "lehte" else "lehte"


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


async def _extract_book_context(book_id: int, db: AsyncSession) -> str:
    """Extract book content from digital copies and RAG chunks.

    Priority: default digital copy → any digital copy → RAG chunks.
    Returns a formatted string with the content.
    """
    # 1. Try default digital copy
    result = await db.execute(
        select(DigitalCopy)
        .where(DigitalCopy.book_id == book_id)
        .order_by(DigitalCopy.is_default.desc(), DigitalCopy.is_primary.desc(), DigitalCopy.created_at.desc())
        .limit(1)
    )
    copy = result.scalar_one_or_none()
    if copy and os.path.isfile(copy.file_path):
        ext = _ext(copy.file_path)
        try:
            with open(copy.file_path, "rb") as f:
                content = f.read()
            if ext == ".pdf":
                raw = extract_text_pdf(content)
            elif ext == ".epub":
                raw = extract_text_epub(content)
            else:
                raw = None
            if raw:
                raw = re.sub(r"\s+", " ", raw).strip()
                # Take first 12000 chars to fit in context window
                return f"KİTAP İÇERİĞİ (varsayılan okuma dosyası - {copy.original_filename}):\n{raw[:12000]}"
        except Exception:
            pass

    # 2. Try any digital copy
    result = await db.execute(
        select(DigitalCopy).where(
            DigitalCopy.book_id == book_id,
            DigitalCopy.type.in_(["pdf", "epub"]),
        ).limit(1)
    )
    copy = result.scalar_one_or_none()
    if copy and os.path.isfile(copy.file_path):
        ext = _ext(copy.file_path)
        try:
            with open(copy.file_path, "rb") as f:
                content = f.read()
            if ext == ".pdf":
                raw = extract_text_pdf(content)
            elif ext == ".epub":
                raw = extract_text_epub(content)
            else:
                raw = None
            if raw:
                raw = re.sub(r"\s+", " ", raw).strip()
                return f"KİTAP İÇERİĞİ ({copy.original_filename}):\n{raw[:12000]}"
        except Exception:
            pass

    # 3. Try RAG chunks
    book = await db.get(Book, book_id)
    if book and book.has_rag:
        chunks = await search_similar_chunks(db, book_id, "kitap içeriği ana karakterler tema", limit=15)
        if chunks:
            context = "\n\n".join(c["content"] for c in chunks)
            return f"KİTAP İÇERİĞİ (RAG chunk'ları):\n{context[:12000]}"

    return ""


async def create_debate_session(
    book_title: str,
    author: str,
    side: str,
    web_search_extra: str = "",
    book_context: str = "",
) -> tuple:
    session_id = str(uuid.uuid4())

    motion = generate_motion(book_title)
    ai_side = get_opposing_side(side)

    web_context = ""
    try:
        results = await search_web(f"{book_title} {author} kitap eleştiri yorum {web_search_extra}", max_results=5)
        web_context = format_search_context(results)
    except Exception:
        pass

    source_parts = []
    if book_context:
        source_parts.append(book_context)
    if web_context:
        source_parts.append(f"WEB KAYNAKLARI:\n{web_context}")

    context_block = "\n\n---\n\n".join(source_parts) if source_parts else ""

    system_prompt = f"""Sen bir Oxford Union münazara asistanısın.

Kitap: "{book_title}" ({author or 'Bilinmiyor'})
Önerme: {motion}

Senin rolün: {ai_side.upper()} tarafı (karşı taraf)
Kullanıcının rolü: {side.upper()} tarafı

KURALLAR:
1. Münazara boyunca sadece {ai_side} tarafını savun.
2. Kullanıcının argümanlarına mantıklı ve akademik yanıtlar ver.
3. 3 tur sonra moderatör olarak kazananı açıkla.
4. Her turda argümanlarını kitabın içeriğine ve kaynaklara dayandır.
5. Asla konu dışına çıkma, sadece önerme ve kitap hakkında konuş.
6. Kibar ve saygılı ol, akademik üslup kullan.
7. Mümkün olduğunca kitabın kendi içeriğinden alıntı yap, sayfa ve bölüm referansı ver.
8. Kitap içeriğin yoksa web kaynaklarını kullan."""

    debate_sessions[session_id] = {
        "book": {"id": 0, "title": book_title, "author": author},
        "motion": motion,
        "user_side": side,
        "ai_side": ai_side,
        "messages": [],
        "round": 0,
        "max_rounds": 3,
        "system_prompt": system_prompt,
        "context": context_block,
    }

    return session_id, motion, side, ai_side, web_context


@router.post("/start")
async def start_debate(
    data: DebateStart,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, data.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    book_context = await _extract_book_context(book.id, db)

    session_id, motion, side, ai_side, web_context = await create_debate_session(
        book.title, book.author or "", data.side,
        web_search_extra="",
        book_context=book_context,
    )
    debate_sessions[session_id]["book"]["id"] = book.id

    context_info = ""
    if book_context:
        context_info = " Kitabın dijital kopyası tarandı ve münazara için kullanıma hazır."
    elif web_context:
        context_info = " Web kaynakları tarandı."

    return DebateResponse(
        session_id=session_id,
        motion=motion,
        side=side,
        ai_side=ai_side,
        messages=[{"role": "system", "content": f"Münazara başladı! Önerme: {motion}\n\nSiz {side} tarafındasınız. İlk argümanınızı sunun.{context_info}", "user": False}],
    )

@router.post("/start-session")
async def start_debate_session(
    data: DebateStartSession,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    from app.models.knowledge_session import KnowledgeSession
    from app.models.knowledge_source import KnowledgeSource
    
    knowledge_session = await db.get(KnowledgeSession, data.session_id)
    if not knowledge_session or knowledge_session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    sources_result = await db.execute(
        select(KnowledgeSource).where(KnowledgeSource.session_id == data.session_id)
    )
    sources = sources_result.scalars().all()
    
    session_title = knowledge_session.name
    book_titles = [s.original_name for s in sources]
    sources_text = ", ".join(book_titles)
    
    # Generate motion based on the session
    motion = f'"{session_title}" kapsamındaki kaynaklar ({sources_text}) üzerine: Bu ev, bu kaynaklarda sunulan ana tezlerin geçerli olduğunu savunur.'
    ai_side = get_opposing_side(data.side)
    
    # We will let the debate loop use the RAG search directly instead of pre-loading context
    # But to match current debate implementation, we can pre-load a small generic context or just use web search
    web_context = ""
    try:
        results = await search_web(f"{session_title} {sources_text} eleştiri inceleme", max_results=3)
        web_context = format_search_context(results)
    except Exception:
        pass

    session_id_str = str(uuid.uuid4())
    system_prompt = f"""Sen bir Oxford Union münazara asistanısın.

Konu: "{session_title}"
Kaynaklar: {sources_text}
Önerme: {motion}

Senin rolün: {ai_side.upper()} tarafı (karşı taraf)
Kullanıcının rolü: {data.side.upper()} tarafı

KURALLAR:
1. Münazara boyunca sadece {ai_side} tarafını savun.
2. Kullanıcının argümanlarına mantıklı ve akademik yanıtlar ver.
3. 3 tur sonra moderatör olarak kazananı açıkla.
4. Argümanlarını sağlanan bağlama ve kaynaklara dayandır.
"""

    debate_sessions[session_id_str] = {
        "book": {"id": 0, "title": session_title, "author": "Knowledge Hub"},
        "knowledge_session_id": knowledge_session.id,
        "motion": motion,
        "user_side": data.side,
        "ai_side": ai_side,
        "messages": [],
        "round": 0,
        "max_rounds": 3,
        "system_prompt": system_prompt,
        "context": f"WEB KAYNAKLARI:\n{web_context}" if web_context else "",
    }

    return DebateResponse(
        session_id=session_id_str,
        motion=motion,
        side=data.side,
        ai_side=ai_side,
        messages=[{"role": "system", "content": f"Bilgi Merkezi oturumu üzerinden münazara başladı!\nÖnerme: {motion}\n\nSiz {data.side} tarafındasınız. İlk argümanınızı sunun.", "user": False}],
    )



@router.post("/start-custom")
async def start_debate_custom(
    data: DebateStartCustom,
    current_user: User = Depends(get_current_user),
):
    if not data.book_title.strip():
        raise HTTPException(status_code=400, detail="Kitap adı gerekli")

    session_id, motion, side, ai_side, web_context = await create_debate_session(
        data.book_title.strip(), data.author.strip(), data.side,
        web_search_extra=f"{data.book_title} {data.author} hakkında bilgi",
    )

    return DebateResponse(
        session_id=session_id,
        motion=motion,
        side=side,
        ai_side=ai_side,
        messages=[{"role": "system", "content": f"Münazara başladı! Önerme: {motion}\n\nSiz {side} tarafındasınız. İlk argümanınızı sunun.", "user": False}],
    )


@router.post("/message")
async def debate_message(
    data: DebateMessage,
    current_user: User = Depends(get_current_user),
):
    session = debate_sessions.get(data.session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı")

    book = session["book"]
    motion = session["motion"]
    side = session["user_side"]
    ai_side = session["ai_side"]
    system_prompt = session["system_prompt"]
    context = session.get("context", "")

    session["messages"].append({"role": "user", "content": data.content})
    session["round"] += 1
    current_round = session["round"]

    if current_round >= session["max_rounds"]:
        judge_prompt = f"""Sen bir münazara hakemisin.

Kitap: "{book['title']}" ({book.get('author') or 'Bilinmiyor'})
Önerme: {motion}

{side.upper()} tarafının argümanları:
{session['messages'][0::2]}

{ai_side.upper()} tarafının argümanları:
{session['messages'][1::2]}

Münazara bitti. Şimdi değerlendir:
1. Hangi taraf daha ikna ediciydi?
2. Hangi taraf daha iyi kaynak kullandı?
3. Mantıksal tutarlılık hangi taraftaydı?

Sonra şu formatta kazananı açıkla:
🏆 KAZANAN: [taraf]
Gerekçe: [kısa açıklama]

Sonra kullanıcıya münazara hakkında bir değerlendirme ver.
"""
        ai_response = await ask_llm([{"role": "system", "content": judge_prompt}, {"role": "user", "content": "Münazarayı değerlendir."}], user=current_user)

        winner = side if side.lower() in ai_response.lower()[:100] else ai_side
        session["winner"] = winner
    else:
        history = []
        for msg in session["messages"]:
            history.append({"role": msg["role"], "content": msg["content"]})

        round_prompt = f"{system_prompt}\n\nTur {current_round}/{session['max_rounds']}.\n\n{ai_side.upper()} tarafı olarak kullanıcının argümanlarına yanıt ver."
        if context:
            round_prompt += f"\n\nÖnceden yüklenmiş kaynaklar:\n{context}"
            
        # Dinamik RAG bağlamı (Eğer knowledge_session ise)
        k_session_id = session.get("knowledge_session_id")
        if k_session_id:
            from app.services.rag_service import search_session_chunks
            chunks = await search_session_chunks(db, k_session_id, data.content, limit=5)
            if chunks:
                rag_context = "\n\n".join(c["content"] for c in chunks)
                round_prompt += f"\n\nRAG KAYNAKLARI (Bu tur için):\n{rag_context}"

        ai_response = await ask_llm([
            {"role": "system", "content": round_prompt},
            *history,
        ], user=current_user)

    session["messages"].append({"role": "assistant", "content": ai_response})

    return DebateResponse(
        session_id=data.session_id,
        motion=motion,
        side=side,
        ai_side=ai_side,
        messages=[
            {"role": m["role"], "content": m["content"], "user": m["role"] == "user"}
            for m in session["messages"]
        ],
        winner=session.get("winner"),
    )
