from fastapi import APIRouter, Depends, Query
from typing import List
from app.schemas.book import ExternalBookResult
from app.services.scrapers import search_all_sources
from app.services.auth_service import get_current_user

router = APIRouter(prefix="/external-search", tags=["external-search"])

@router.get("", response_model=List[ExternalBookResult])
async def search_external_books(
    q: str = Query(..., min_length=2),
    type: str = Query("title", regex="^(title|isbn)$"),
    current_user=Depends(get_current_user)
):
    """
    Search for books across multiple external sources (Google Books, Kitapyurdu, Nadirkitap, etc.)
    """
    results = await search_all_sources(q, search_type=type)
    return results
