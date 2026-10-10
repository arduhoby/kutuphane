from pydantic import BaseModel
from typing import Optional


class BookSearchResult(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    publication_year: Optional[str] = None
    cover_url: Optional[str] = None
    source: Optional[str] = None
    preview_url: Optional[str] = None
    epub_url: Optional[str] = None
    pdf_url: Optional[str] = None
