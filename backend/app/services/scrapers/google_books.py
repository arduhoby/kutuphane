import httpx
from typing import List
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper

from app.config import settings

class GoogleBooksScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Google Books API"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        if not query:
            return []
            
        q = f"isbn:{query}" if search_type == "isbn" else query
        url = "https://www.googleapis.com/books/v1/volumes"
        
        try:
            params = {"q": q, "maxResults": 5}
            if settings.GOOGLE_API_KEY:
                params["key"] = settings.GOOGLE_API_KEY

            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(url, params=params)
                response.raise_for_status()
                data = response.json()
                
                results = []
                for item in data.get("items", []):
                    vol = item.get("volumeInfo", {})
                    
                    # Get ISBN
                    isbn = None
                    for identifier in vol.get("industryIdentifiers", []):
                        if identifier.get("type") in ["ISBN_13", "ISBN_10"]:
                            isbn = identifier.get("identifier")
                            break
                            
                    # Get cover URL
                    cover_url = None
                    images = vol.get("imageLinks", {})
                    if "thumbnail" in images:
                        cover_url = images["thumbnail"].replace("http:", "https:")
                        
                    authors = vol.get("authors", [])
                    author = authors[0] if authors else None
                    
                    results.append(ExternalBookResult(
                        title=vol.get("title", ""),
                        author=author,
                        publisher=vol.get("publisher"),
                        isbn=isbn,
                        cover_url=cover_url,
                        source=self.source_name
                    ))
                    
                return results
                
        except Exception as e:
            print(f"Google Books API error: {e}")
            return []
