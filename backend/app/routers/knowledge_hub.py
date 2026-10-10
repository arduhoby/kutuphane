from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.book import Book
from app.models.knowledge_session import KnowledgeSession
from app.models.knowledge_source import KnowledgeSource, SourceType, SourceStatus
from app.models.knowledge_message import KnowledgeMessage
from app.models.knowledge_session_invite import KnowledgeSessionInvite
from app.models.knowledge_report import KnowledgeReport
from app.models.report_citation import ReportCitation
from app.services.auth_service import get_current_user
from app.services.rag_service import search_session_chunks
from app.services.llm_service import ask_llm

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

class SessionCreate(BaseModel):
    name: str
    is_public: bool = False

class SourceAddBook(BaseModel):
    book_id: int

@router.post("/sessions")
async def create_session(
    data: SessionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = KnowledgeSession(user_id=current_user.id, name=data.name, is_public=data.is_public)
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id": session.id, "name": session.name, "is_public": session.is_public, "created_at": session.created_at}

@router.get("/sessions")
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(KnowledgeSession).where(KnowledgeSession.user_id == current_user.id)
    )
    sessions = result.scalars().all()
    return [{"id": s.id, "name": s.name, "created_at": s.created_at} for s in sessions]

@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.delete(session)
    await db.commit()
    return {"success": True}

@router.post("/sessions/{session_id}/sources/book")
async def add_book_source(
    session_id: int,
    data: SourceAddBook,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    book = await db.get(Book, data.book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Book not found")
        
    source = KnowledgeSource(
        session_id=session_id,
        source_type=SourceType.BOOK,
        book_id=book.id,
        original_name=book.title,
        status=SourceStatus.INDEXED if book.has_rag else SourceStatus.PENDING
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    return {"id": source.id, "original_name": source.original_name, "status": source.status}

class SourceAddDocuments(BaseModel):
    copy_ids: List[int]

@router.post("/sessions/{session_id}/sources/documents")
async def add_document_sources(
    session_id: int,
    data: SourceAddDocuments,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    
    from app.models.digital_copy import DigitalCopy
    result = await db.execute(select(DigitalCopy).where(DigitalCopy.id.in_(data.copy_ids)))
    copies = result.scalars().all()
    
    if not copies:
        raise HTTPException(status_code=404, detail="Documents not found")
        
    added_sources = []
    for copy in copies:
        book = await db.get(Book, copy.book_id)
        title = book.title if book else "Bilinmeyen Kitap"
        
        # Check if already added
        existing = await db.execute(select(KnowledgeSource).where(
            KnowledgeSource.session_id == session_id,
            KnowledgeSource.digital_copy_id == copy.id
        ))
        if existing.scalar_one_or_none():
            continue
            
        source = KnowledgeSource(
            session_id=session_id,
            source_type=SourceType.DOCUMENT,
            book_id=copy.book_id,
            digital_copy_id=copy.id,
            original_name=f"{title} ({copy.original_filename or copy.type})",
            status=SourceStatus.INDEXED
        )
        db.add(source)
        added_sources.append(source)
        
    await db.commit()
    
    return [
        {"id": s.id, "original_name": s.original_name, "status": s.status}
        for s in added_sources
    ]

@router.get("/sessions/{session_id}/sources")
async def list_sources(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    result = await db.execute(
        select(KnowledgeSource).where(KnowledgeSource.session_id == session_id)
    )
    sources = result.scalars().all()
    return [{
        "id": s.id, 
        "source_type": s.source_type, 
        "original_name": s.original_name, 
        "status": s.status,
        "book_id": s.book_id
    } for s in sources]

class AskRequest(BaseModel):
    question: str

from fastapi import UploadFile, File
from app.services.rag_service import process_book_file
from sqlalchemy.exc import IntegrityError
import uuid

@router.post("/sessions/{session_id}/sources/file")
async def upload_document_source(
    session_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
        
    # Benzersiz bir ISBN atayalım çakışma olmaması için
    dummy_isbn = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    book = Book(
        title=file.filename,
        author="Kullanıcı Belgesi",
        isbn=dummy_isbn,
        tags="knowledge_hub_document",
        is_ebook=True,
        has_rag=False,
        added_by=current_user.id
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    
    # RAG İşlemi (PDF/EPUB/DOCX okuma veya OCR)
    try:
        await process_book_file(book.id, file.filename, content, db, user=current_user)
    except Exception as e:
        await db.delete(book)
        await db.commit()
        raise HTTPException(status_code=400, detail=str(e))
        
    # Kaynağı session'a bağla
    source = KnowledgeSource(
        session_id=session_id,
        source_type=SourceType.DOCUMENT,
        book_id=book.id,
        original_name=file.filename,
        status=SourceStatus.INDEXED
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return {"id": source.id, "original_name": source.original_name, "status": source.status}

@router.post("/sessions/{session_id}/sources/image")
async def upload_image_source(
    session_id: int,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
        
    # Convert image to PDF format temporarily so ocr_pdf can handle it, 
    # or write a direct image OCR function. 
    # Since `pytesseract` can directly do image to string, let's just do it here.
    import pytesseract
    from PIL import Image
    import io
    from app.services.rag_service import chunk_text, generate_embedding, ai_correct_ocr_text
    from app.models.book_chunk import BookChunk
    
    try:
        image = Image.open(io.BytesIO(content))
        raw_text = pytesseract.image_to_string(image, lang="tur+eng")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"OCR hatası: {str(e)}")
        
    if not raw_text.strip():
        raise HTTPException(status_code=400, detail="Görselde okunabilir metin bulunamadı.")
        
    dummy_isbn = f"IMG-{uuid.uuid4().hex[:8].upper()}"
    book = Book(
        title=file.filename,
        author="Kullanıcı Görseli (OCR)",
        isbn=dummy_isbn,
        tags="knowledge_hub_image",
        is_ebook=True,
        has_rag=True,
        notes="OCR ile metne çevrildi.",
        added_by=current_user.id
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    
    corrected_text = await ai_correct_ocr_text(raw_text.strip(), file.filename, user=current_user)
    chunks = chunk_text(corrected_text)
    
    for i, chunk in enumerate(chunks):
        import json
        embedding = await generate_embedding(chunk)
        db_chunk = BookChunk(
            book_id=book.id,
            chunk_index=i,
            content=chunk,
            embedding=json.dumps(embedding) if embedding else None,
        )
        db.add(db_chunk)
        
    source = KnowledgeSource(
        session_id=session_id,
        source_type=SourceType.IMAGE,
        book_id=book.id,
        original_name=file.filename,
        status=SourceStatus.INDEXED
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return {"id": source.id, "original_name": source.original_name, "status": source.status}

class UrlRequest(BaseModel):
    url: str

@router.post("/sessions/{session_id}/sources/url")
async def add_url_source(
    session_id: int,
    data: UrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    import httpx
    import uuid
    import os
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(data.url, follow_redirects=True)
            response.raise_for_status()
            content = response.content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Dosya indirilemedi: {str(e)}")
        
    filename = os.path.basename(data.url.split("?")[0])
    if not filename:
        filename = "indirilen_dosya.pdf"
        
    dummy_isbn = f"DOC-{uuid.uuid4().hex[:8].upper()}"
    book = Book(
        title=filename,
        author="Kullanıcı Belgesi (URL)",
        isbn=dummy_isbn,
        tags="knowledge_hub_document",
        is_ebook=True,
        has_rag=False,
        added_by=current_user.id
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    
    from app.services.rag_service import process_book_file
    try:
        await process_book_file(book.id, filename, content, db, user=current_user)
    except Exception as e:
        await db.delete(book)
        await db.commit()
        raise HTTPException(status_code=400, detail=str(e))
        
    source = KnowledgeSource(
        session_id=session_id,
        source_type=SourceType.DOCUMENT,
        book_id=book.id,
        original_name=filename,
        status=SourceStatus.INDEXED
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return {"id": source.id, "original_name": source.original_name, "status": source.status}

class YoutubeRequest(BaseModel):
    url: str

@router.post("/sessions/{session_id}/sources/youtube")
async def add_youtube_source(
    session_id: int,
    data: YoutubeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    import re
    from youtube_transcript_api import YouTubeTranscriptApi
    from app.services.rag_service import chunk_text, generate_embedding
    from app.models.book_chunk import BookChunk
    import json
    
    # Extract video ID
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", data.url)
    if not match:
        raise HTTPException(status_code=400, detail="Geçersiz YouTube URL'si")
    video_id = match.group(1)
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['tr', 'en'])
        raw_text = " ".join([t['text'] for t in transcript])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YouTube altyazısı alınamadı: {str(e)}")
        
    dummy_isbn = f"YT-{video_id}"
    book = Book(
        title=f"YouTube Videosu ({video_id})",
        author="YouTube Yüklemesi",
        isbn=dummy_isbn,
        tags="knowledge_hub_video",
        is_ebook=True,
        has_rag=True,
        notes="YouTube altyazısından elde edildi.",
        added_by=current_user.id,
        pdf_url=data.url  # store url temporarily here for search context
    )
    db.add(book)
    await db.commit()
    await db.refresh(book)
    
    chunks = chunk_text(raw_text)
    
    for i, chunk in enumerate(chunks):
        embedding = await generate_embedding(chunk)
        db_chunk = BookChunk(
            book_id=book.id,
            chunk_index=i,
            content=chunk,
            embedding=json.dumps(embedding) if embedding else None,
        )
        db.add(db_chunk)
        
    source = KnowledgeSource(
        session_id=session_id,
        source_type=SourceType.VIDEO,
        book_id=book.id,
        file_path=data.url,  # Store url here
        original_name=f"YouTube Video",
        status=SourceStatus.INDEXED
    )
    db.add(source)
    await db.commit()
    await db.refresh(source)
    
    return {"id": source.id, "original_name": source.original_name, "status": source.status, "url": data.url}


@router.get("/sessions/{session_id}/messages")
async def get_messages(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    result = await db.execute(
        select(KnowledgeMessage).where(KnowledgeMessage.session_id == session_id).order_by(KnowledgeMessage.created_at.asc())
    )
    messages = result.scalars().all()
    
    out = []
    for m in messages:
        import json
        sources = []
        if m.sources_json:
            try:
                sources = json.loads(m.sources_json)
            except:
                pass
        out.append({
            "id": m.id,
            "role": m.role,
            "content": m.content,
            "sources": sources,
            "created_at": m.created_at
        })
    return out

@router.post("/sessions/{session_id}/ask")
async def ask_session(
    session_id: int,
    data: AskRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    # User message'ı kaydet
    user_msg = KnowledgeMessage(
        session_id=session_id,
        role="user",
        content=data.question
    )
    db.add(user_msg)
    await db.commit()
        
    # Get similar chunks across all sources in session
    chunks = await search_session_chunks(db, session_id, data.question, limit=10)
    
    context_parts = []
    for c in chunks:
        book = await db.get(Book, c["book_id"])
        title = book.title if book else "Bilinmeyen Kaynak"
        context_parts.append(f"Kaynak: {title}\nAlıntı: {c['content']}")
        
    context_text = "\n\n".join(context_parts)
    
    if not context_text:
        answer = "Bu oturumdaki kaynaklarda sorunuzla ilgili bilgi bulunamadı."
        unique_books = []
    else:
        prompt = [
            {"role": "system", "content": "Sen bir araştırma asistanısın. Sağlanan kaynak metinleri kullanarak kullanıcının sorusuna cevap ver. Cevabını verirken mutlaka hangi kaynaktan yararlandığını belirt."},
            {"role": "user", "content": f"Kaynaklar:\n{context_text}\n\nSoru: {data.question}"}
        ]
        
        answer = await ask_llm(prompt, user=current_user)
        
        unique_books = []
        seen = set()
        for c in chunks:
            if c["book_id"] not in seen:
                seen.add(c["book_id"])
                book = await db.get(Book, c["book_id"])
                if book:
                    unique_books.append({"id": book.id, "title": book.title, "url": book.pdf_url})
    
    # Assistant message'ı kaydet
    import json
    asst_msg = KnowledgeMessage(
        session_id=session_id,
        role="assistant",
        content=answer,
        sources_json=json.dumps(unique_books) if unique_books else None
    )
    db.add(asst_msg)
    await db.commit()
                
    return {"answer": answer, "sources": unique_books}

class ReportRequest(BaseModel):
    topic: str

@router.post("/sessions/{session_id}/report")
async def generate_report(
    session_id: int,
    data: ReportRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    chunks = await search_session_chunks(db, session_id, data.topic, limit=20)
    
    if not chunks:
        raise HTTPException(status_code=400, detail="Bu konuda yeterli kaynak bulunamadı.")
        
    context_parts = []
    chunk_map = {} # map index to chunk_id
    
    for idx, c in enumerate(chunks, 1):
        book = await db.get(Book, c["book_id"])
        title = book.title if book else "Bilinmeyen Kaynak"
        context_parts.append(f"Kaynak [{idx}] ({title}):\n{c['content']}")
        chunk_map[idx] = c["id"]
        
    context_text = "\n\n".join(context_parts)
    
    prompt = [
        {"role": "system", "content": "Sen bir akademik araştırma asistanısın. Aşağıda sağlanan kaynak metinlere (Kaynak [1], Kaynak [2] şeklinde belirtilmiş) dayanarak kullanıcının konusuna detaylı, profesyonel ve akademik bir dille markdown formatında bir rapor yaz. Yazarken, hangi bilgiyi hangi kaynaktan aldığını mutlaka [1], [2] formatında metin içinde atıf yaparak belirt. Cümlelerin sonuna atıf numarasını ekle."},
        {"role": "user", "content": f"Kaynaklar:\n{context_text}\n\nRapor Konusu: {data.topic}"}
    ]
    
    report_text = await ask_llm(prompt, user=current_user)
    
    import hashlib
    import uuid
    
    # Kriptografik snapshot
    snapshot_data = report_text + "\n" + context_text
    content_hash = hashlib.sha256(snapshot_data.encode('utf-8')).hexdigest()
    share_token = str(uuid.uuid4())
    
    report = KnowledgeReport(
        session_id=session_id,
        topic=data.topic,
        content=report_text,
        content_hash=content_hash,
        share_token=share_token
    )
    db.add(report)
    await db.commit()
    await db.refresh(report)
    
    # Atıfları kaydet
    import re
    citations = set(map(int, re.findall(r"\[(\d+)\]", report_text)))
    for c_idx in citations:
        if c_idx in chunk_map:
            rc = ReportCitation(
                report_id=report.id,
                chunk_id=chunk_map[c_idx],
                citation_index=c_idx,
            )
            db.add(rc)
            
    await db.commit()
    
    return {
        "id": report.id,
        "topic": report.topic,
        "content_hash": report.content_hash,
        "share_token": report.share_token,
        "created_at": report.created_at
    }

@router.get("/sessions/{session_id}/reports")
async def list_reports(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Session not found")
        
    result = await db.execute(
        select(KnowledgeReport).where(KnowledgeReport.session_id == session_id).order_by(KnowledgeReport.created_at.desc())
    )
    reports = result.scalars().all()
    
    return [{
        "id": r.id,
        "topic": r.topic,
        "content_hash": r.content_hash,
        "share_token": r.share_token,
        "created_at": r.created_at
    } for r in reports]
class InviteRequest(BaseModel):
    user_id: int
    role: str = "viewer"

@router.post("/sessions/{session_id}/invite")
async def invite_to_session(
    session_id: int,
    data: InviteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = await db.get(KnowledgeSession, session_id)
    if not session or session.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Oturum bulunamadı veya yetkiniz yok.")
        
    invited_user = await db.get(User, data.user_id)
    if not invited_user:
        raise HTTPException(status_code=404, detail="Kullanıcı bulunamadı.")
        
    existing = await db.execute(
        select(KnowledgeSessionInvite).where(
            KnowledgeSessionInvite.session_id == session_id,
            KnowledgeSessionInvite.user_id == data.user_id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Kullanıcı zaten davetli.")
        
    invite = KnowledgeSessionInvite(
        session_id=session_id,
        user_id=data.user_id,
        invited_by=current_user.id,
        role=data.role
    )
    db.add(invite)
    await db.commit()
    
    return {"success": True, "message": "Davet gönderildi."}
