from typing import List
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper

class NadirkitapScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Nadirkitap"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        if not query:
            return []
            
        url = "https://www.nadirkitap.com/kitapara.php"
        params = {
            "aramakelimesi": query
        }
        
        soup = await self.fetch_html(url, params)
        if not soup:
            return []
            
        results = []
        products = soup.select(".product-list-item") or soup.select(".product")
        
        # If no standard items found, let's try a fallback
        if not products:
            # Nadirkitap search result pages vary, checking for '.list-item' or similar
            products = soup.select(".list-item")
            
        for p in products[:5]:
            title_el = p.select_one(".product-title") or p.select_one("h2") or p.select_one(".name")
            title = title_el.text.strip() if title_el else None
            if not title:
                continue
                
            author_el = p.select_one(".product-author") or p.select_one(".author")
            author = author_el.text.strip() if author_el else None
            
            pub_el = p.select_one(".product-publisher") or p.select_one(".publisher")
            publisher = pub_el.text.strip() if pub_el else None
            
            img_el = p.select_one("img")
            cover_url = img_el.get("src") if img_el else None
                
            results.append(ExternalBookResult(
                title=title,
                author=author,
                publisher=publisher,
                cover_url=cover_url,
                source=self.source_name
            ))
            
        return results
