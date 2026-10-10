from typing import List
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper

class DrScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "D&R"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        if not query:
            return []
            
        url = "https://www.dr.com.tr/search"
        params = {"q": query}
        
        soup = await self.fetch_html(url, params)
        if not soup:
            return []
            
        results = []
        products = soup.select(".prd-main-wrapper") or soup.select(".product-list .item")
        
        for p in products[:3]:
            title_el = p.select_one(".prd-name") or p.select_one("h3")
            title = title_el.text.strip() if title_el else None
            if not title:
                continue
                
            author_el = p.select_one(".prd-publisher")
            author = author_el.text.strip() if author_el else None
            
            img_el = p.select_one("img.prd-image") or p.select_one("img")
            cover_url = img_el.get("src") if img_el else None
                
            results.append(ExternalBookResult(
                title=title,
                author=author,
                cover_url=cover_url,
                source=self.source_name
            ))
            
        return results
