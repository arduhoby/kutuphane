import urllib.parse
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper
from bs4 import BeautifulSoup
from typing import List

class DoganKitapScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Doğan Kitap"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        url = f"https://www.dogankitap.com.tr/arama?q={urllib.parse.quote(query)}"
        
        soup = await self.fetch_html(url)
        if not soup:
            return []

        results = []
        items = soup.select(".book-card, .product, .search-result-item")
        
        for item in items[:3]:
            try:
                title_elem = item.select_one(".title, .book-title, h3")
                title = title_elem.text.strip() if title_elem else ""
                
                author_elem = item.select_one(".author, .book-author")
                author = author_elem.text.strip() if author_elem else ""
                
                publisher = "Doğan Kitap"  # Default since it's their site
                
                img_elem = item.select_one("img")
                cover_url = img_elem.get("src") if img_elem else ""
                if cover_url and not cover_url.startswith("http"):
                    cover_url = "https://www.dogankitap.com.tr" + (cover_url if cover_url.startswith("/") else "/" + cover_url)
                    
                if title:
                    results.append(ExternalBookResult(
                        title=title,
                        author=author,
                        publisher=publisher,
                        cover_url=cover_url,
                        source=self.source_name
                    ))
            except Exception as e:
                print(f"Error parsing Dogan Kitap item: {e}")
                continue
                
        return results
