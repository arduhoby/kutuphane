from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List


class ShelfBasic(BaseModel):
    id: int
    name: str
    color: Optional[str] = None
    
    model_config = {"from_attributes": True}


class BookCreate(BaseModel):
    title: str
    author: Optional[str] = None
    publisher: Optional[str] = None
    isbn: Optional[str] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    publication_year: Optional[str] = None
    shelf: Optional[str] = None
    shelf_id: Optional[int] = None
    shelf_ids: Optional[List[int]] = []
    tags: Optional[str] = None
    notes: Optional[str] = None
    is_read: bool = False
    is_ebook: bool = False
    cover_url: Optional[str] = None
    pdf_url: Optional[str] = None
    epub_url: Optional[str] = None
    ai_summary: Optional[str] = None
    category: Optional[str] = None
    external_cover_url: Optional[str] = None


class ExternalBookResult(BaseModel):
    title: str
    author: Optional[str] = None
    publisher: Optional[str] = None
    isbn: Optional[str] = None
    cover_url: Optional[str] = None
    source: str



class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    publisher: Optional[str] = None
    isbn: Optional[str] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    publication_year: Optional[str] = None
    shelf: Optional[str] = None
    shelf_id: Optional[int] = None
    shelf_ids: Optional[List[int]] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    is_read: Optional[bool] = None
    is_ebook: Optional[bool] = None
    cover_url: Optional[str] = None
    pdf_url: Optional[str] = None
    epub_url: Optional[str] = None
    ai_summary: Optional[str] = None
    category: Optional[str] = None


class BookOut(BaseModel):
    id: int
    title: str
    author: Optional[str] = None
    publisher: Optional[str] = None
    isbn: Optional[str] = None
    page_count: Optional[int] = None
    language: Optional[str] = None
    publication_year: Optional[str] = None
    shelf: Optional[str] = None
    shelf_id: Optional[int] = None
    shelf_name: Optional[str] = None
    shelf_color: Optional[str] = None
    shelves: Optional[List[ShelfBasic]] = []
    tags: Optional[str] = None
    notes: Optional[str] = None
    is_read: bool
    is_ebook: bool
    cover_url: Optional[str] = None
    pdf_url: Optional[str] = None
    epub_url: Optional[str] = None
    has_rag: bool = False
    has_digital_copy: bool = False
    ai_summary: Optional[str] = None
    category: Optional[str] = None
    added_by: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BookSearch(BaseModel):
    query: Optional[str] = None
    author: Optional[str] = None
    shelf: Optional[str] = None
    is_read: Optional[bool] = None
    is_ebook: Optional[bool] = None
    skip: int = 0
    limit: int = 50


class BookListResponse(BaseModel):
    items: list[BookOut]
    total: int
    skip: int
    limit: int
