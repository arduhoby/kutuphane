import asyncio
import logging
import httpx
from typing import Dict, Any, List

from app.config import settings

logger = logging.getLogger(__name__)


async def search_books(query: str, limit: int = 8) -> List[Dict[str, Any]]:
    results = []
    seen = set()

    ol_results = await _search_openlibrary(query, limit)
    for r in ol_results:
        key = r.get("title", "") + "|" + r.get("author", "")
        if key not in seen:
            seen.add(key)
            results.append(r)

    gb_results = await _search_google(query, limit)
    for r in gb_results:
        key = r.get("title", "") + "|" + r.get("author", "")
        if key not in seen:
            seen.add(key)
            results.append(r)

    return results[:limit]


async def _search_openlibrary(query: str, limit: int) -> List[Dict[str, Any]]:
    url = "https://openlibrary.org/search.json"
    params = {"q": query, "limit": limit, "fields": "title,author_name,publisher,number_of_pages_median,first_publish_year,language,cover_i,ebook_access,ebook_count_i,key"}
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, params=params, timeout=10, headers={"User-Agent": "Kutuphane/1.0"})
            if resp.status_code != 200:
                logger.warning("OpenLibrary search %s: %s", resp.status_code, query)
                return []
            data = resp.json()
            docs = data.get("docs", [])
        except httpx.TimeoutException:
            logger.warning("OpenLibrary search timeout: %s", query)
            return []
        except Exception as e:
            logger.error("OpenLibrary search hatası: %s", e)
            return []

    results = []
    for d in docs:
        cover_i = d.get("cover_i")
        cover_url = f"https://covers.openlibrary.org/b/id/{cover_i}-L.jpg" if cover_i else None

        isbn_list = d.get("isbn", [])
        results.append({
            "isbn": isbn_list[0] if isbn_list else None,
            "title": d.get("title"),
            "author": ", ".join(d.get("author_name", [])),
            "publisher": d.get("publisher", [None])[0] if d.get("publisher") else None,
            "page_count": d.get("number_of_pages_median") or (d.get("number_of_pages") or [None])[0],
            "language": (d.get("language") or [None])[0],
            "publication_year": str(d.get("first_publish_year", "")) if d.get("first_publish_year") else None,
            "cover_url": cover_url,
            "source": "openlibrary",
            "ebook_access": d.get("ebook_access"),
        })

    return results


async def _search_google(query: str, limit: int) -> List[Dict[str, Any]]:
    params = {"q": query, "maxResults": limit}
    if settings.GOOGLE_API_KEY:
        params["key"] = settings.GOOGLE_API_KEY

    items = []
    async with httpx.AsyncClient() as client:
        for attempt in range(2):
            try:
                resp = await client.get(
                    "https://www.googleapis.com/books/v1/volumes",
                    params=params,
                    timeout=10,
                    headers={"User-Agent": "Kutuphane/1.0"},
                )
                if resp.status_code == 429:
                    logger.warning("Google API rate limit")
                    await asyncio.sleep(2)
                    continue
                if resp.status_code == 403:
                    logger.error("Google API 403 — API anahtarı geçersiz veya eksik")
                    return []
                if resp.status_code == 401:
                    logger.error("Google API 401 — API anahtarı hatalı")
                    return []
                if resp.status_code != 200:
                    logger.warning("Google API %s: %s", resp.status_code, query)
                    return []
                data = resp.json()
                items = data.get("items", [])
                break
            except httpx.TimeoutException:
                logger.warning("Google API timeout (deneme %s)", attempt + 1)
                continue
            except Exception as e:
                logger.error("Google API hatası: %s", e)
                return []

    results = []
    for item in items:
        info = item.get("volumeInfo", {})
        sale = item.get("saleInfo", {})
        access = item.get("accessInfo", {})

        cover_url = None
        images = info.get("imageLinks", {})
        if images.get("extraLarge"):
            cover_url = images["extraLarge"]
        elif images.get("large"):
            cover_url = images["large"]
        elif images.get("thumbnail"):
            cover_url = images["thumbnail"]
        if cover_url and "http" not in cover_url:
            cover_url = "https://" + cover_url.lstrip("//")

        preview_link = info.get("previewLink")
        epub_link = access.get("epub", {}).get("downloadLink") or access.get("epub", {}).get("acsTokenLink")
        pdf_link = access.get("pdf", {}).get("downloadLink") or access.get("pdf", {}).get("acsTokenLink")

        identifiers = info.get("industryIdentifiers") or []
        isbn_13 = next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_13"), None)
        isbn_10 = next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_10"), None)

        results.append({
            "isbn": isbn_13 or isbn_10,
            "title": info.get("title"),
            "author": ", ".join(info.get("authors", [])),
            "publisher": info.get("publisher"),
            "page_count": info.get("pageCount"),
            "language": info.get("language"),
            "publication_year": (info.get("publishedDate") or "")[:4],
            "cover_url": cover_url,
            "source": "google",
            "preview_url": preview_link,
            "epub_url": epub_link,
            "pdf_url": pdf_link,
        })

    return results
