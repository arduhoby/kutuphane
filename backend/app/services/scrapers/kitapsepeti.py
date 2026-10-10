import urllib.parse
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper
from bs4 import BeautifulSoup
from typing import List

class KitapsepetiScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Kitapsepeti"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        # They usually use 'q' parameter for search
        url = f"https://www.kitapsepeti.com/arama?q={urllib.parse.quote(query)}"
        
        soup = await self.fetch_html(url)
        if not soup:
            return []

        results = []
        # Find product items (typically class varies, looking for generic product item containers)
        items = soup.select(".product-item, .col-md-3.col-sm-4.col-xs-6, .fl.col-12.text-center.mt")
        
        for item in items[:3]:
            try:
                title_elem = item.select_one(".text-description, .product-title, .title")
                title = title_elem.text.strip() if title_elem else ""
                
                author_elem = item.select_one(".author, .product-author")
                author = author_elem.text.strip() if author_elem else ""
                
                publisher_elem = item.select_one(".publisher, .product-publisher")
                publisher = publisher_elem.text.strip() if publisher_elem else ""
                
                img_elem = item.select_one("img.lazyload, img")
                cover_url = img_elem.get("data-src") or img_elem.get("src") if img_elem else ""
                if cover_url and not cover_url.startswith("http"):
                    cover_url = "https://www.kitapsepeti.com" + cover_url
                    
                if title:
                    results.append(ExternalBookResult(
                        title=title,
                        author=author,
                        publisher=publisher,
                        cover_url=cover_url,
                        source=self.source_name
                    ))
            except Exception as e:
                print(f"Error parsing Kitapsepeti item: {e}")
                continue
                
        return results
