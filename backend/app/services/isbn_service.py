import asyncio
import logging
import re
import httpx
from typing import Optional, Dict, Any

from app.config import settings

logger = logging.getLogger(__name__)


def _clean_isbn(isbn: str) -> str:
    return re.sub(r'[^0-9Xx]', '', isbn).upper()


async def lookup_isbn(isbn: str) -> Optional[Dict[str, Any]]:
    clean = _clean_isbn(isbn)
    if not clean:
        logger.warning("Geçersiz ISBN: %s", isbn)
        return None

    result = await _lookup_openlibrary(clean)
    if result:
        return result
    logger.info("OpenLibrary'de bulunamadı, Google deneniyor: %s", clean)
    result = await _lookup_google(clean)
    if result:
        return result
    logger.warning("Hiçbir kaynakta bulunamadı: %s", clean)
    return None


def _extract_isbn(identifiers: list | None) -> str | None:
    if not identifiers:
        return None
    isbn_13 = next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_13"), None)
    if isbn_13:
        return isbn_13
    return next((i["identifier"] for i in identifiers if i.get("type") == "ISBN_10"), None)


async def _lookup_google(isbn: str) -> Optional[Dict[str, Any]]:
    params = {"q": f"isbn:{isbn}"}
    if settings.GOOGLE_API_KEY:
        params["key"] = settings.GOOGLE_API_KEY

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
                    logger.warning("Google API rate limit, %s saniye bekleniyor", 2)
                    await asyncio.sleep(2)
                    continue
                if resp.status_code == 403:
                    logger.error("Google API 403 — API anahtarı geçersiz veya eksik")
                    return None
                if resp.status_code == 401:
                    logger.error("Google API 401 — API anahtarı hatalı")
                    return None
                if resp.status_code != 200:
                    logger.warning("Google API %s döndü: %s", resp.status_code, resp.text[:200])
                    return None
                data = resp.json()
                if "items" not in data or not data["items"]:
                    logger.info("Google API'de sonuç yok: %s", isbn)
                    return None
                info = data["items"][0]["volumeInfo"]
                return {
                    "isbn": _extract_isbn(info.get("industryIdentifiers")),
                    "title": info.get("title"),
                    "author": ", ".join(info.get("authors", [])),
                    "publisher": info.get("publisher"),
                    "page_count": info.get("pageCount"),
                    "language": info.get("language"),
                    "publication_year": info.get("publishedDate", ""),
                    "cover_url": info.get("imageLinks", {}).get("thumbnail", ""),
                }
            except httpx.TimeoutException:
                logger.warning("Google API timeout (deneme %s)", attempt + 1)
                continue
            except Exception as e:
                logger.error("Google API hatası: %s", e)
                return None
        return None


async def _lookup_openlibrary(isbn: str) -> Optional[Dict[str, Any]]:
    url = f"https://openlibrary.org/api/books?bibkeys=ISBN:{isbn}&format=json&jscmd=data"
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(url, timeout=10, headers={"User-Agent": "Kutuphane/1.0"})
            if resp.status_code != 200:
                logger.warning("OpenLibrary %s döndü: %s", resp.status_code, isbn)
                return None
            data = resp.json()
            key = f"ISBN:{isbn}"
            if key not in data:
                logger.info("OpenLibrary'de ISBN bulunamadı: %s", isbn)
                return None
            info = data[key]
            cover = info.get("cover", {})
            identifiers = info.get("identifiers", {})
            openlib_isbn = (
                identifiers.get("isbn_13", [None])[0]
                or identifiers.get("isbn_10", [None])[0]
            )
            return {
                "isbn": openlib_isbn,
                "title": info.get("title"),
                "author": ", ".join(a["name"] for a in info.get("authors", [])),
                "publisher": info.get("publishers", [{}])[0].get("name") if info.get("publishers") else None,
                "page_count": info.get("number_of_pages"),
                "language": info.get("languages", [{}])[0].get("key", "").split("/")[-1] if info.get("languages") else None,
                "publication_year": info.get("publish_date", ""),
                "cover_url": cover.get("large", cover.get("medium", cover.get("small", ""))),
            }
        except httpx.TimeoutException:
            logger.warning("OpenLibrary timeout: %s", isbn)
            return None
        except Exception as e:
            logger.error("OpenLibrary hatası: %s", e)
            return None
