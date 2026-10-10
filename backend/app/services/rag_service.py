import io
import json
import math
import re
from typing import Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import httpx
from urllib.parse import quote, urlparse

from app.models.book_chunk import BookChunk
from app.models.book import Book
from app.services.llm_service import ask_llm
from app.services.embed_service import get_embedding

CHUNK_SIZE = 500
CHUNK_OVERLAP = 50


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(x * x for x in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> list[str]:
    words = text.split()
    chunks = []
    start = 0
    while start < len(words):
        end = start + chunk_size
        chunk = " ".join(words[start:end])
        if chunk.strip():
            chunks.append(chunk)
        if end >= len(words):
            break
        start = end - overlap
    return chunks


async def generate_embedding(text: str) -> Optional[list[float]]:
    """Geriye dönük uyumluluk için korundu — get_embedding'i çağırır."""
    return await get_embedding(text)


def extract_text_pdf(content: bytes) -> str:
    from pypdf import PdfReader
    reader = PdfReader(io.BytesIO(content))
    text = []
    for page in reader.pages:
        t = page.extract_text()
        if t:
            text.append(t)
    return "\n".join(text)


def extract_text_epub(content: bytes) -> str:
    import ebooklib
    from ebooklib import epub
    from bs4 import BeautifulSoup

    book = epub.read_epub(io.BytesIO(content))
    text = []
    for item in book.get_items():
        if item.get_type() == ebooklib.ITEM_DOCUMENT:
            soup = BeautifulSoup(item.get_content(), "html.parser")
            text.append(soup.get_text())
    return "\n".join(text)


def extract_text_docx(content: bytes) -> str:
    from docx import Document
    try:
        doc = Document(io.BytesIO(content))
        paras = []
        for para in doc.paragraphs:
            if para.text.strip():
                paras.append(para.text)
        return "\n".join(paras)
    except Exception:
        import subprocess, tempfile, os
        with tempfile.NamedTemporaryFile(suffix=".doc", delete=False) as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        try:
            result = subprocess.run(
                ["textutil", "-convert", "txt", "-stdout", tmp_path],
                capture_output=True, text=True, timeout=15,
            )
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip()
        except Exception:
            pass
        finally:
            try: os.unlink(tmp_path)
            except: pass
        raise ValueError("Belge okunamadı. Yalnızca .docx dosyaları RAG için desteklenir.")


def ocr_pdf(content: bytes, max_pages: int = 30, dpi: int = 150, on_progress=None) -> str:
    """OCR a scanned PDF using Tesseract. Returns extracted text.
    on_progress: optional callback(current_page, total_pages) for progress tracking.
    """
    import pytesseract
    from pdf2image import convert_from_bytes

    pages = convert_from_bytes(content, dpi=dpi, first_page=1, last_page=max_pages)
    total = len(pages)
    texts = []
    for i, page in enumerate(pages):
        try:
            t = pytesseract.image_to_string(page, lang="tur+eng")
            if t.strip():
                texts.append(t)
        except Exception:
            continue
        if on_progress:
            on_progress(i + 1, total)
    return "\n".join(texts)


async def ai_correct_ocr_text(raw_text: str, book_title: str, user=None) -> str:
    """Aktif LLM (yerel veya Claude) ile OCR hatalarını düzeltir."""
    if not raw_text or len(raw_text) < 50:
        return raw_text

    # Modeli karıştıran görsel referanslarını temizle
    raw_text = re.sub(r'\[image\.png\]', '', raw_text)
    raw_text = re.sub(r'!\[.*?\]\(.*?\)', '', raw_text)
    raw_text = re.sub(r'Figure\s+\d+:', '', raw_text)
    raw_text = re.sub(r'Resim\s+\d+:', '', raw_text)
    raw_text = re.sub(r'\[.*?image.*?\]', '', raw_text, flags=re.IGNORECASE)
    raw_text = re.sub(r'\n\s*\n', '\n', raw_text)

    corrected_parts = []
    chunk_size = 4000
    for i in range(0, len(raw_text), chunk_size):
        chunk = raw_text[i : i + chunk_size]
        prompt = [
            {
                "role": "system",
                "content": (
                    f'Aşağıda OCR ile taranmış bir kitabın metni var (Kitap: "{book_title}").\n'
                    "Görevin:\n"
                    "1. OCR hatalarını düzelt (yanlış karakterler, birleşik/karışık kelimeler)\n"
                    "2. Eksik veya bozuk kelimeleri bağlamdan tamamla\n"
                    "3. Anlamı koru, yeni içerik uydurma\n"
                    "4. Sadece düzeltilmiş metni döndür, açıklama ekleme"
                ),
            },
            {"role": "user", "content": chunk},
        ]
        try:
            corrected = await ask_llm(prompt, max_tokens=len(chunk.split()) * 2, user=user)
            if corrected and len(corrected) > 10:
                corrected_parts.append(corrected)
            else:
                corrected_parts.append(chunk)
        except Exception:
            corrected_parts.append(chunk)
    return "\n".join(corrected_parts)


async def process_book_file(
    book_id: int,
    filename: str,
    content: bytes,
    db: AsyncSession,
    copy_id: Optional[int] = None,
    user=None,
) -> int:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    is_ocr = False
    
    def _do_extract():
        if ext == "pdf":
            t = extract_text_pdf(content)
            if not t.strip():
                t = ocr_pdf(content)
                return t, bool(t.strip())
            return t, False
        elif ext == "epub":
            return extract_text_epub(content), False
        elif ext in ("doc", "docx"):
            return extract_text_docx(content), False
        else:
            raise ValueError(f"Desteklenmeyen dosya türü: {ext}")

    import asyncio
    raw_text, is_ocr = await asyncio.to_thread(_do_extract)

    raw_text = re.sub(r"\s+", " ", raw_text).strip()
    if not raw_text:
        raise ValueError("Dosyadan metin çıkarılamadı.")

    if is_ocr:
        book = await db.get(Book, book_id)
        book_title = book.title if book else filename
        raw_text = await ai_correct_ocr_text(raw_text, book_title, user=user)

    if copy_id:
        await db.execute(BookChunk.__table__.delete().where(BookChunk.copy_id == copy_id))
    else:
        await db.execute(BookChunk.__table__.delete().where(BookChunk.book_id == book_id))

    chunks = chunk_text(raw_text)
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

    await db.execute(
        Book.__table__.update().where(Book.id == book_id).values(has_rag=True)
    )

    if is_ocr:
        existing_notes = book.notes if book and book.notes else ""
        ocr_note = "Bu kitap görüntü PDF olarak yüklenmiş, FirBook OCR hizmeti ile metne çevrilmiştir."
        if ocr_note not in existing_notes:
            new_notes = f"{existing_notes}\n{ocr_note}".strip() if existing_notes else ocr_note
            await db.execute(
                Book.__table__.update().where(Book.id == book_id).values(notes=new_notes)
            )

    await db.commit()
    return total


async def auto_fill_rag(
    book_id: int,
    book_title: str,
    book_author: Optional[str],
    isbn: Optional[str],
    db: AsyncSession,
) -> dict:
    query = f"{book_title} {book_author or ''}"
    sources = []

    # 1. Open Library'de ücretsiz e-kitap var mı?
    ol_url = "https://openlibrary.org/search.json"
    ol_params = {"q": query, "limit": 3, "fields": "title,author_name,key,ebook_access,ebook_count_i"}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.get(ol_url, params=ol_params)
            if resp.status_code == 200:
                docs = resp.json().get("docs", [])
                for d in docs:
                    if d.get("ebook_access") in ["borrow", "printdisabled", "yes"]:
                        key = d.get("key", "")
                        sources.append({
                            "source": "Open Library",
                            "url": f"https://openlibrary.org{key}",
                            "type": "Ödünç Al",
                            "free": True,
                        })
    except Exception:
        pass

    # 2. DuckDuckGo'da PDF/EPUB ara
    try:
        from app.services.web_search_service import search_web
        web_results = await search_web(f"{query} pdf epub download", max_results=6)
        for r in web_results:
            url = r.get("url", "")
            snippet = r.get("snippet", "").lower()
            title_r = r.get("title", "")
            is_pdf = url.endswith(".pdf") or "pdf" in url or "epub" in url or "indir" in snippet or "download" in snippet
            sources.append({
                "source": extract_site_name(url),
                "url": url,
                "type": "PDF/EPUB" if is_pdf else "Site",
                "free": "ücretsiz" in snippet or "free" in snippet or is_pdf,
                "snippet": r.get("snippet", ""),
            })
    except Exception:
        pass

    # 3. Google Books'tan preview var mı?
    gb_url = "https://www.googleapis.com/books/v1/volumes"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.get(gb_url, params={"q": query, "maxResults": 3})
            if resp.status_code == 200:
                for item in resp.json().get("items", []):
                    access = item.get("accessInfo", {})
                    preview = access.get("viewability", "")
                    if preview in ["PARTIAL", "ALL_PAGES"]:
                        info = item.get("volumeInfo", {})
                        link = info.get("previewLink", "")
                        sources.append({
                            "source": "Google Books",
                            "url": link,
                            "type": "Önizleme",
                            "free": access.get("embeddable", False),
                        })
    except Exception:
        pass

    # 4. Gutenberg'de var mı?
    gut_url = f"https://gutendex.com/books?search={quote(query)}"
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            resp = await c.get(gut_url)
            if resp.status_code == 200:
                for b in resp.json().get("results", [])[:2]:
                    book_id_g = b.get("id")
                    formats = b.get("formats", {})
                    pdf_url = formats.get("application/pdf", "")
                    epub_url = formats.get("application/epub+zip", "")
                    if pdf_url or epub_url:
                        sources.append({
                            "source": "Project Gutenberg",
                            "url": f"https://www.gutenberg.org/ebooks/{book_id_g}",
                            "type": "Kamu Malı",
                            "free": True,
                            "download_url": pdf_url or epub_url,
                        })
    except Exception:
        pass

    # try to download the first free direct link
    download_url = None
    for s in sources:
        if s.get("download_url"):
            download_url = s["download_url"]
            break

    if download_url:
        try:
            async with httpx.AsyncClient(timeout=60, follow_redirects=True) as c:
                resp = await c.get(download_url)
                if resp.status_code == 200 and len(resp.content) > 1000:
                    ext = ".pdf" if "pdf" in download_url else ".epub"
                    count = await process_book_file(book_id, f"book{ext}", resp.content, db)
                    return {"success": True, "message": f"Otomatik indirildi ve {count} bölüm işlendi.", "sources": sources, "reviews": []}
        except Exception:
            pass

    # İndiremedik → yorum/analiz ara (çok dilli)
    reviews = []
    for lang_query in [query, f"{query} book review analysis", f"{query} kitap yorum inceleme", f"{query} book review summary"]:
        try:
            r = await search_web(lang_query, max_results=4)
            for item in r:
                reviews.append({
                    "title": item.get("title", ""),
                    "snippet": item.get("snippet", ""),
                    "url": item.get("url", ""),
                    "lang": "tr" if "turk" in lang_query.lower() or "kitap" in lang_query.lower() else "en",
                })
        except Exception:
            pass

    return {"success": False, "message": "Ücretsiz kaynak bulunamadı. Aşağıdaki yorum/analizleri inceleyip kitabın dijital halini yükleyebilirsiniz.", "sources": sources[:10], "reviews": reviews[:15], "agent_note": "Tarafınızca yüklenen kitaplar akademik tartışma amacıyla kullanılır."}


def extract_site_name(url: str) -> str:
    try:
        host = urlparse(url).hostname or ""
        return host.replace("www.", "").split(".")[0].capitalize()
    except Exception:
        return "Web"


async def search_similar_chunks(
    db: AsyncSession,
    book_id: int,
    query: str,
    limit: int = 5,
) -> list[dict]:
    query_emb = await generate_embedding(query)
    if not query_emb:
        return []

    result = await db.execute(
        select(BookChunk).where(
            BookChunk.book_id == book_id,
            BookChunk.embedding.isnot(None),
        )
    )
    chunks = result.scalars().all()

    scored = []
    for chunk in chunks:
        emb = json.loads(chunk.embedding)
        sim = cosine_similarity(query_emb, emb)
        scored.append((sim, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    return [
        {
            "id": chunk.id,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "distance": 1.0 - sim,
        }
        for sim, chunk in top
    ]


async def search_session_chunks(
    db: AsyncSession,
    session_id: int,
    query: str,
    limit: int = 10,
) -> list[dict]:
    from app.models.knowledge_source import KnowledgeSource
    
    query_emb = await generate_embedding(query)
    if not query_emb:
        return []

    # Get all copy_ids and book_ids associated with this session's sources
    sources_result = await db.execute(
        select(KnowledgeSource).where(
            KnowledgeSource.session_id == session_id,
            or_(
                KnowledgeSource.digital_copy_id.isnot(None),
                KnowledgeSource.book_id.isnot(None)
            )
        )
    )
    sources = sources_result.scalars().all()
    copy_ids = [s.digital_copy_id for s in sources if s.digital_copy_id is not None]
    book_ids = [s.book_id for s in sources if s.digital_copy_id is None and s.book_id is not None]
    
    if not copy_ids and not book_ids:
        return []

    # Get chunks matching either copy_ids or book_ids (for backwards compatibility)
    conditions = []
    if copy_ids:
        conditions.append(BookChunk.copy_id.in_(copy_ids))
    if book_ids:
        conditions.append(BookChunk.book_id.in_(book_ids))

    result = await db.execute(
        select(BookChunk).where(
            or_(*conditions),
            BookChunk.embedding.isnot(None),
        )
    )
    chunks = result.scalars().all()

    scored = []
    for chunk in chunks:
        emb = json.loads(chunk.embedding)
        sim = cosine_similarity(query_emb, emb)
        scored.append((sim, chunk))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = scored[:limit]

    return [
        {
            "id": chunk.id,
            "book_id": chunk.book_id,
            "copy_id": chunk.copy_id,
            "chunk_index": chunk.chunk_index,
            "content": chunk.content,
            "distance": 1.0 - sim,
        }
        for sim, chunk in top
    ]
