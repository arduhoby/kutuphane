import os
import re
import json
import uuid
import asyncio
import logging
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query, Header, BackgroundTasks
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import select, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.config import settings
from app.models.book import Book
from app.models.user import User
from app.models.digital_copy import DigitalCopy
from app.models.book_chunk import BookChunk
from app.schemas.digital_copy import DigitalCopyOut, DigitalCopyUpdate
from app.services.auth_service import get_current_user, get_user_from_token
from app.services.rag_service import (
    process_book_file,
    search_similar_chunks,
    extract_text_pdf,
    extract_text_epub,
    ocr_pdf,
    ai_correct_ocr_text,
)
from app.services.llm_service import ask_llm
from app.services.web_search_service import search_web

router = APIRouter(prefix="/copies", tags=["digital_copies"])

ALLOWED_EXTENSIONS = {".pdf", ".epub", ".txt", ".md", ".html", ".htm", ".doc", ".docx"}
MAX_FILE_SIZE = 100 * 1024 * 1024


def _ext(path: str) -> str:
    return os.path.splitext(path)[1].lower()


def _guess_type(filename: str) -> str:
    ext = _ext(filename)
    if ext == ".pdf":
        return "pdf"
    elif ext == ".epub":
        return "epub"
    elif ext in (".txt", ".md", ".html", ".htm", ".doc", ".docx"):
        return "article"
    return "other"


def _user_owns_or_admin(copy: DigitalCopy, user: User) -> bool:
    return copy.user_id == user.id or user.is_admin


async def _run_rag_background(book_id: int, filename: str, content: bytes, copy_id: int, user_id: Optional[int] = None):
    from app.database import async_session
    from app.services.rag_service import process_book_file
    
    async with async_session() as db:
        try:
            await db.execute(
                DigitalCopy.__table__.update().where(DigitalCopy.id == copy_id).values(rag_status="running")
            )
            await db.commit()

            user = await db.get(User, user_id) if user_id else None
            await process_book_file(book_id, filename, content, db, copy_id=copy_id, user=user)
            
            await db.execute(
                DigitalCopy.__table__.update().where(DigitalCopy.id == copy_id).values(rag_status="ok")
            )
            await db.commit()
        except Exception as e:
            err_msg = str(e)[:100]
            await db.execute(
                DigitalCopy.__table__.update().where(DigitalCopy.id == copy_id).values(rag_status=f"failed: {err_msg}")
            )
            await db.commit()


# ── List copies for a book ──────────────────────────────────────
@router.get("/book/{book_id}", response_model=list[DigitalCopyOut])
async def list_copies(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(DigitalCopy)
        .where(DigitalCopy.book_id == book_id)
        .order_by(DigitalCopy.is_default.desc(), DigitalCopy.is_primary.desc(), DigitalCopy.created_at.desc())
    )
    return result.scalars().all()


# ── Upload a copy (auto-RAG for PDF/EPUB) ──────────────────────
@router.post("/book/{book_id}/upload", response_model=DigitalCopyOut, status_code=201)
async def upload_copy(
    book_id: int,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    is_public: bool = Form(False),
    description: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Boş dosya")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Dosya çok büyük (maks 100MB)")

    filename = file.filename or "unknown"
    ext = _ext(filename)
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Desteklenmeyen dosya türü: {ext}. İzin verilenler: PDF, EPUB, TXT, MD, HTML, DOC, DOCX"
        )
    copy_type = _guess_type(filename)

    book_dir = os.path.join(settings.EBOOKS_DIR, str(book_id))
    os.makedirs(book_dir, exist_ok=True)
    stored_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(book_dir, stored_name)
    with open(file_path, "wb") as f:
        f.write(content)

    existing = await db.execute(
        select(func.count(DigitalCopy.id)).where(DigitalCopy.book_id == book_id)
    )
    is_first = existing.scalar() == 0

    copy = DigitalCopy(
        book_id=book_id,
        user_id=current_user.id,
        type=copy_type,
        file_path=file_path,
        original_filename=filename,
        file_size=len(content),
        mime_type=file.content_type or "application/octet-stream",
        is_public=is_public,
        is_primary=is_first,
        is_default=is_first,
        description=description,
    )
    db.add(copy)
    await db.flush()

    await db.execute(
        Book.__table__.update().where(Book.id == book_id).values(
            has_digital_copy=True,
            is_ebook=True,
        )
    )

    # auto-RAG for PDF/EPUB/DOC
    rag_status = "skipped"
    if ext in (".pdf", ".epub", ".doc", ".docx"):
        rag_status = "queued"
        background_tasks.add_task(
            _run_rag_background, book_id, filename, content, copy.id, current_user.id
        )

    await db.commit()
    await db.refresh(copy)
    copy.rag_status = rag_status
    return copy


# ── Update copy metadata ────────────────────────────────────────
@router.put("/{copy_id}", response_model=DigitalCopyOut)
async def update_copy(
    copy_id: int,
    data: DigitalCopyUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404, detail="Dijital kopya bulunamadı")
    if not _user_owns_or_admin(copy, current_user):
        raise HTTPException(status_code=403)

    if data.is_primary:
        await db.execute(
            DigitalCopy.__table__.update()
            .where(DigitalCopy.book_id == copy.book_id)
            .values(is_primary=False)
        )
    if data.is_default:
        await db.execute(
            DigitalCopy.__table__.update()
            .where(DigitalCopy.book_id == copy.book_id)
            .values(is_default=False)
        )

    for key, val in data.model_dump(exclude_unset=True).items():
        setattr(copy, key, val)

    await db.commit()
    await db.refresh(copy)
    return copy


# ── Delete a copy ───────────────────────────────────────────────
@router.delete("/{copy_id}", status_code=204)
async def delete_copy(
    copy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404, detail="Dijital kopya bulunamadı")
    if not _user_owns_or_admin(copy, current_user):
        raise HTTPException(status_code=403)

    if os.path.isfile(copy.file_path):
        os.remove(copy.file_path)

    await db.delete(copy)
    await db.commit()

    remaining = await db.execute(
        select(func.count(DigitalCopy.id)).where(DigitalCopy.book_id == copy.book_id)
    )
    if remaining.scalar() == 0:
        await db.execute(
            Book.__table__.update()
            .where(Book.id == copy.book_id)
            .values(has_digital_copy=False)
        )
        await db.commit()


# ── Download / serve a copy ──────────────────────────────────────
@router.get("/{copy_id}/download")
async def download_copy(
    copy_id: int,
    token: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
):
    bearer = token
    if not bearer and authorization and authorization.startswith("Bearer "):
        bearer = authorization[7:]
    if not bearer:
        raise HTTPException(status_code=401, detail="Not authenticated")
    current_user = await get_user_from_token(bearer, db)

    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404)
    if not _user_owns_or_admin(copy, current_user) and not copy.is_public:
        raise HTTPException(status_code=403)
    if not os.path.isfile(copy.file_path):
        raise HTTPException(status_code=404, detail="Dosya diskte bulunamadı")

    return FileResponse(
        copy.file_path,
        media_type=copy.mime_type or "application/octet-stream",
        filename=copy.original_filename or f"copy_{copy_id}",
    )


# ── Get default readable copy ────────────────────────────────────
@router.get("/book/{book_id}/read")
async def get_readable_copy(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns the default copy for reading (is_default → is_primary → first)."""
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    result = await db.execute(
        select(DigitalCopy)
        .where(DigitalCopy.book_id == book_id)
        .order_by(DigitalCopy.is_default.desc(), DigitalCopy.is_primary.desc(), DigitalCopy.created_at.desc())
        .limit(1)
    )
    copy = result.scalar_one_or_none()
    if not copy:
        raise HTTPException(status_code=404, detail="Dijital kopya bulunamadı")
    if not os.path.isfile(copy.file_path):
        raise HTTPException(status_code=404, detail="Dosya diskte bulunamadı")

    return DigitalCopyOut.model_validate(copy)


# ── Public copies (discovery) ────────────────────────────────────
@router.get("/public", response_model=list[DigitalCopyOut])
async def list_public_copies(
    query: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(DigitalCopy).where(DigitalCopy.is_public == True)
    if query:
        stmt = (
            stmt.join(Book)
            .where(or_(Book.title.ilike(f"%{query}%"), Book.author.ilike(f"%{query}%")))
        )
    stmt = stmt.order_by(DigitalCopy.created_at.desc()).offset(skip).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


# ── Set primary (RAG) ────────────────────────────────────────────
@router.post("/{copy_id}/set-primary", response_model=DigitalCopyOut)
async def set_primary_copy(
    copy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404)
    if not _user_owns_or_admin(copy, current_user):
        raise HTTPException(status_code=403)

    await db.execute(
        DigitalCopy.__table__.update()
        .where(DigitalCopy.book_id == copy.book_id)
        .values(is_primary=False)
    )
    copy.is_primary = True
    await db.commit()
    await db.refresh(copy)
    return copy


# ── Set default (reading) ────────────────────────────────────────
@router.post("/{copy_id}/set-default", response_model=DigitalCopyOut)
async def set_default_copy(
    copy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404)
    if not _user_owns_or_admin(copy, current_user):
        raise HTTPException(status_code=403)

    await db.execute(
        DigitalCopy.__table__.update()
        .where(DigitalCopy.book_id == copy.book_id)
        .values(is_default=False)
    )
    copy.is_default = True
    await db.commit()
    await db.refresh(copy)
    return copy


# ── Manual OCR for scanned PDFs (async) ──────────────────────────
import asyncio
import logging

logger = logging.getLogger(__name__)

# In-memory OCR job tracker
ocr_jobs: dict[int, dict] = {}


class OCRResponse(BaseModel):
    success: bool
    message: str
    chunk_count: int = 0


class OCRStatusResponse(BaseModel):
    status: str  # "idle" | "running" | "done" | "failed"
    phase: str = ""  # "ocr" | "ai_correction" | "embedding" | "done"
    progress: str = ""  # "12/30 sayfa" etc.
    message: str = ""
    chunk_count: int = 0


@router.post("/{copy_id}/ocr", response_model=OCRResponse)
async def ocr_copy(
    copy_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Start OCR on a scanned PDF copy. Returns immediately, runs in background."""
    copy = await db.get(DigitalCopy, copy_id)
    if not copy:
        raise HTTPException(status_code=404, detail="Dijital kopya bulunamadı")
    if not _user_owns_or_admin(copy, current_user):
        raise HTTPException(status_code=403)
    if not os.path.isfile(copy.file_path):
        raise HTTPException(status_code=404, detail="Dosya diskte bulunamadı")

    ext = _ext(copy.file_path)
    if ext != ".pdf":
        raise HTTPException(status_code=400, detail="OCR sadece PDF dosyaları için desteklenir")

    # Check if already running
    if copy_id in ocr_jobs and ocr_jobs[copy_id]["status"] == "running":
        return OCRResponse(success=False, message="OCR bu dosya için zaten çalışıyor.")

    # Check if text layer already exists
    with open(copy.file_path, "rb") as f:
        content = f.read()
    existing_text = extract_text_pdf(content)
    if existing_text and existing_text.strip():
        return OCRResponse(success=False, message="Bu PDF'de zaten metin katmanı var, OCR gerekli değil.")

    # Initialize job
    ocr_jobs[copy_id] = {
        "status": "running",
        "phase": "ocr",
        "progress": "0",
        "message": "",
        "chunk_count": 0,
    }

    # Launch background task
    background_tasks.add_task(_run_ocr_background, copy_id, copy.file_path, copy.book_id, current_user.id)

    return OCRResponse(success=True, message="OCR arka planda başladı. İlerlemeyi takip edebilirsiniz.")


@router.get("/{copy_id}/ocr/status", response_model=OCRStatusResponse)
async def ocr_status(
    copy_id: int,
    current_user: User = Depends(get_current_user),
):
    """Check OCR job progress."""
    job = ocr_jobs.get(copy_id)
    if not job:
        return OCRStatusResponse(status="idle")
    return OCRStatusResponse(
        status=job["status"],
        phase=job.get("phase", ""),
        progress=job.get("progress", ""),
        message=job.get("message", ""),
        chunk_count=job.get("chunk_count", 0),
    )


async def _run_ocr_background(copy_id: int, file_path: str, book_id: int, user_id: Optional[int] = None):
    """Background OCR + AI correction + RAG indexing."""
    from app.services.rag_service import chunk_text, generate_embedding, ai_correct_ocr_text
    from app.database import async_session

    job = ocr_jobs[copy_id]

    try:
        with open(file_path, "rb") as f:
            content = f.read()

        # Phase 1: OCR
        job["phase"] = "ocr"

        def on_progress(current, total):
            job["progress"] = f"{current}/{total} sayfa"

        raw_text = await asyncio.get_event_loop().run_in_executor(
            None, lambda: ocr_pdf(content, max_pages=30, dpi=150, on_progress=on_progress)
        )

        if not raw_text.strip():
            job["status"] = "failed"
            job["message"] = "OCR metin çıkarılamadı."
            return

        # Phase 2: AI correction (yerel LLM veya kullanıcının Claude anahtarı)
        job["phase"] = "ai_correction"
        job["progress"] = "Yapay zeka düzeltmesi..."

        async with async_session() as db:
            book = await db.get(Book, book_id)
            book_title = book.title if book else "kitap"
            user = await db.get(User, user_id) if user_id else None

            corrected_text = await ai_correct_ocr_text(
                re.sub(r"\s+", " ", raw_text).strip(), book_title, user=user
            )

        # Phase 3: Save chunks immediately (RAG usable right away)
        job["phase"] = "embedding"
        job["progress"] = "Ham metin kaydediliyor..."

        async with async_session() as db:
            book = await db.get(Book, book_id)
            book_title = book.title if book else "kitap"

            raw_text_clean = re.sub(r"\s+", " ", corrected_text).strip()
            await db.execute(BookChunk.__table__.delete().where(BookChunk.copy_id == copy_id))

            chunks = chunk_text(raw_text_clean)
            total = 0
            for i, chunk in enumerate(chunks):
                embedding = await generate_embedding(chunk)
                db_chunk = BookChunk(
                    book_id=book_id,
                    copy_id=copy_id,
                    chunk_index=i,
                    content=chunk,
                    embedding=json.dumps(embedding) if embedding else None,
                )
                db.add(db_chunk)
                total += 1
                job["progress"] = f"Embedding: {total}/{len(chunks)}"

            await db.execute(
                Book.__table__.update().where(Book.id == book_id).values(has_rag=True)
            )

            # Add OCR note
            existing_notes = book.notes or ""
            ocr_note = "Bu kitap görüntü PDF olarak yüklenmiş, FirBook OCR hizmeti ile metne çevrilmiştir."
            if ocr_note not in existing_notes:
                new_notes = f"{existing_notes}\n{ocr_note}".strip() if existing_notes else ocr_note
                await db.execute(
                    Book.__table__.update().where(Book.id == book_id).values(notes=new_notes)
                )

            await db.commit()

        job["chunk_count"] = total
        job["status"] = "done"
        job["phase"] = "done"
        job["progress"] = f"{total} chunk"
        job["message"] = f"OCR tamamlandı. {total} chunk oluşturuldu, RAG aktif."

        logger.info(f"OCR completed for copy {copy_id}: {total} chunks")

    except Exception as e:
        job["status"] = "failed"
        job["message"] = str(e)
        logger.error(f"OCR failed for copy {copy_id}: {e}")


# ── Summary from default reading file ───────────────────────────
class SummaryResponse(BaseModel):
    summary: str
    source_count: int = 0


async def _summarize_text(book_title: str, book_author: Optional[str], text: str, user=None) -> str:
    """Send extracted text to the active LLM (local veya Claude) and return the summary."""
    prompt = [
        {"role": "system", "content": f"""Kitap: {book_title}\nYazar: {book_author or ''}\n\nGörev: Aşağıdaki kitap içeriğine dayanarak kısa bir özet çıkar.\nKurallar:\n- Sadece verilen içerikten yola çıkarak yaz.\n- 3-5 cümle ile ana temaları ve önemli noktaları anlat.\n- Doğrudan alıntı yapma, kendi cümlelerinle anlat."""},
        {"role": "user", "content": text[:8000]},
    ]
    return await ask_llm(prompt, user=user)


async def _extract_and_summarize_file(file_path: str, book_title: str, book_author: Optional[str], user=None) -> Optional[tuple[str, int]]:
    """Extract text from a PDF/EPUB file and summarize it."""
    if not os.path.isfile(file_path):
        return None
    ext = _ext(file_path)
    try:
        def _read_and_extract():
            with open(file_path, "rb") as f:
                content = f.read()
            if ext == ".pdf":
                return extract_text_pdf(content)
            elif ext == ".epub":
                return extract_text_epub(content)
            return None

        raw = await asyncio.to_thread(_read_and_extract)
        if not raw:
            return None
            
        raw = re.sub(r"\s+", " ", raw).strip()
        if not raw:
            return None
            
        summary = await _summarize_text(book_title, book_author, raw, user=user)
        # rough "source count" = approximate pages (500 words per page)
        page_estimate = max(1, len(raw.split()) // 500)
        return summary, page_estimate
    except Exception:
        return None


@router.post("/book/{book_id}/summary", response_model=SummaryResponse)
async def generate_summary(
    book_id: int,
    force: bool = Query(False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    if book.ai_summary and not force:
        return SummaryResponse(summary=book.ai_summary, source_count=0)

    # 1. Try default (is_default) copy first
    result = await db.execute(
        select(DigitalCopy)
        .where(DigitalCopy.book_id == book_id)
        .order_by(DigitalCopy.is_default.desc(), DigitalCopy.is_primary.desc(), DigitalCopy.created_at.desc())
        .limit(1)
    )
    default_copy = result.scalar_one_or_none()
    if default_copy:
        r = await _extract_and_summarize_file(default_copy.file_path, book.title, book.author, user=current_user)
        if r:
            book.ai_summary = r[0]
            await db.commit()
            return SummaryResponse(summary=r[0], source_count=r[1])

    # 2. Fallback: try any PDF/EPUB copy
    copies_result = await db.execute(
        select(DigitalCopy).where(
            DigitalCopy.book_id == book_id,
            DigitalCopy.type.in_(["pdf", "epub"]),
        )
    )
    for copy in copies_result.scalars().all():
        r = await _extract_and_summarize_file(copy.file_path, book.title, book.author, user=current_user)
        if r:
            book.ai_summary = r[0]
            await db.commit()
            return SummaryResponse(summary=r[0], source_count=r[1])

    # 3. Fallback: try RAG chunks
    if book.has_rag:
        chunks = await search_similar_chunks(db, book_id, "kitap özeti ana temalar konu", limit=10)
        if chunks:
            context = "\n\n".join(c["content"] for c in chunks)
            try:
                summary = await _summarize_text(book.title, book.author, context, user=current_user)
                book.ai_summary = summary
                await db.commit()
                return SummaryResponse(summary=summary, source_count=len(chunks))
            except Exception:
                pass

    # 4. Fallback: web search
    q = f"{book.title} {book.author or ''} kitap özeti inceleme"
    try:
        results = await search_web(q, max_results=5)
        web_text = "\n".join(f"- {r.get('title','')}: {r.get('snippet','')} ({r.get('url','')})" for r in results)
        if web_text:
            prompt = [
                {"role": "system", "content": f"""Kitap: {book.title}\nYazar: {book.author or ''}\n\nAşağıda web'den bulunan bilgiler var. Bunlara dayanarak kitabın kısa bir özetini çıkar.\nKaynakları yanıtında belirt. Uydurma yapma.\nBilgi yoksa 'Bu kitap için kaynak bulunamadı' de."""},
                {"role": "user", "content": f"Web kaynakları:\n{web_text}"},
            ]
            summary = await ask_llm(prompt, user=current_user)
            book.ai_summary = summary
            await db.commit()
            return SummaryResponse(summary=summary, source_count=len(results))
    except Exception:
        pass

    return SummaryResponse(
        summary="Bu kitap için dijital kopya bulunmamaktadır. Yukarıdan bir dosya yükleyip özet alabilirsiniz.",
        source_count=0,
    )


# ── Web search for summary sources ──────────────────────────────
class WebSearchItem(BaseModel):
    title: str
    snippet: str
    url: str
    source: str


class WebSearchResponse(BaseModel):
    sources: list[WebSearchItem]


@router.post("/book/{book_id}/summary/web-search", response_model=WebSearchResponse)
async def web_search_summary(
    book_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    q = f"{book.title} {book.author or ''} kitap özet inceleme yorum"
    results = await search_web(q, max_results=10)
    return WebSearchResponse(
        sources=[
            WebSearchItem(title=r.get("title", ""), snippet=r.get("snippet", ""), url=r.get("url", ""), source="Web")
            for r in results
        ]
    )

class UrlRequest(BaseModel):
    url: str
    description: Optional[str] = None

@router.post("/book/{book_id}/url", response_model=DigitalCopyOut)
async def add_url_copy(
    book_id: int,
    data: UrlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    import httpx
    import os
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(data.url, follow_redirects=True)
            response.raise_for_status()
            content = response.content
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Sayfa indirilemedi: {str(e)}")
        
    filename = os.path.basename(data.url.split("?")[0])
    if not filename:
        filename = "web_sayfasi.html"
        
    copy = DigitalCopy(
        book_id=book.id,
        user_id=current_user.id,
        type="url",
        file_path=data.url,
        original_filename=filename,
        file_size=len(content),
        mime_type="text/html",
        description=data.description[:30] if data.description else None
    )
    db.add(copy)
    
    book.has_digital_copy = True
    await db.commit()
    await db.refresh(copy)
    
    # Process for RAG
    try:
        from app.services.rag_service import chunk_text, generate_embedding
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(content, 'html.parser')
        raw_text = soup.get_text(separator=' ', strip=True)
        chunks = chunk_text(raw_text)
        
        for i, chunk in enumerate(chunks):
            embedding = await generate_embedding(chunk)
            db_chunk = BookChunk(
                book_id=book.id,
                copy_id=copy.id,
                chunk_index=i,
                content=chunk,
                embedding=json.dumps(embedding) if embedding else None,
            )
            db.add(db_chunk)
            
        book.has_rag = True
        await db.commit()
    except Exception as e:
        logging.error(f"Error processing URL for RAG: {e}")
        
    return copy

class YoutubeRequest(BaseModel):
    url: str
    description: Optional[str] = None

@router.post("/book/{book_id}/youtube", response_model=DigitalCopyOut)
async def add_youtube_copy(
    book_id: int,
    data: YoutubeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    book = await db.get(Book, book_id)
    if not book:
        raise HTTPException(status_code=404, detail="Kitap bulunamadı")

    import re
    from youtube_transcript_api import YouTubeTranscriptApi
    from app.services.rag_service import chunk_text, generate_embedding
    
    match = re.search(r"(?:v=|\/)([0-9A-Za-z_-]{11}).*", data.url)
    if not match:
        raise HTTPException(status_code=400, detail="Geçersiz YouTube URL'si")
    video_id = match.group(1)
    
    try:
        transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=['tr', 'en'])
        raw_text = " ".join([t['text'] for t in transcript])
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"YouTube altyazısı alınamadı: {str(e)}")
        
    copy = DigitalCopy(
        book_id=book.id,
        user_id=current_user.id,
        type="youtube",
        file_path=data.url,
        original_filename=f"YouTube Video ({video_id})",
        file_size=len(raw_text),
        mime_type="text/plain",
        description=data.description[:30] if data.description else None
    )
    db.add(copy)
    
    book.has_digital_copy = True
    await db.commit()
    await db.refresh(copy)
    
    # Process for RAG
    try:
        chunks = chunk_text(raw_text)
        
        for i, chunk in enumerate(chunks):
            embedding = await generate_embedding(chunk)
            db_chunk = BookChunk(
                book_id=book.id,
                copy_id=copy.id,
                chunk_index=i,
                content=chunk,
                embedding=json.dumps(embedding) if embedding else None,
            )
            db.add(db_chunk)
            
        book.has_rag = True
        await db.commit()
    except Exception as e:
        logging.error(f"Error processing YouTube for RAG: {e}")
        
    return copy
