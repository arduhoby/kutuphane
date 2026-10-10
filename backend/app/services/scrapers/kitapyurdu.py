from typing import List
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper

class KitapyurduScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Kitapyurdu"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        if not query:
            return []
            
        url = "https://www.kitapyurdu.com/index.php"
        params = {
            "route": "product/search",
            "filter_name": query
        }
        
        soup = await self.fetch_html(url, params)
        if not soup:
            return []
            
        results = []
        products = soup.select(".product-cr")
        
        for p in products[:5]:
            title_el = p.select_one(".name a")
            title = title_el.text.strip() if title_el else None
            if not title:
                continue
                
            author_el = p.select_one(".author span")
            if not author_el:
                author_el = p.select_one(".author a")
            author = author_el.text.strip() if author_el else None
            
            pub_el = p.select_one(".publisher span a span")
            if not pub_el:
                pub_el = p.select_one(".publisher span")
            publisher = pub_el.text.strip() if pub_el else None
            
            img_el = p.select_one(".image img")
            cover_url = img_el.get("src") if img_el else None
            
            # Remove smaller size identifier from URL if possible
            if cover_url and "MNRESIZE" in cover_url:
                cover_url = cover_url.replace("MNRESIZE/200/200/", "")
                
            results.append(ExternalBookResult(
                title=title,
                author=author,
                publisher=publisher,
                cover_url=cover_url,
                source=self.source_name
            ))
            
        return results
