import urllib.parse
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper
from bs4 import BeautifulSoup
from typing import List

class YkyScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "YKY"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        url = f"https://katalog.ykykultur.com.tr/arama?q={urllib.parse.quote(query)}"
        
        soup = await self.fetch_html(url)
        if not soup:
            return []

        results = []
        items = soup.select(".product-item, .book-card")
        
        for item in items[:3]:
            try:
                title_elem = item.select_one(".product-title, .title")
                title = title_elem.text.strip() if title_elem else ""
                
                author_elem = item.select_one(".product-author, .author")
                author = author_elem.text.strip() if author_elem else ""
                
                publisher = "Yapı Kredi Yayınları"
                
                img_elem = item.select_one("img")
                cover_url = img_elem.get("src") if img_elem else ""
                if cover_url and not cover_url.startswith("http"):
                    cover_url = "https://katalog.ykykultur.com.tr" + (cover_url if cover_url.startswith("/") else "/" + cover_url)
                    
                if title:
                    results.append(ExternalBookResult(
                        title=title,
                        author=author,
                        publisher=publisher,
                        cover_url=cover_url,
                        source=self.source_name
                    ))
            except Exception as e:
                print(f"Error parsing YKY item: {e}")
                continue
                
        return results
