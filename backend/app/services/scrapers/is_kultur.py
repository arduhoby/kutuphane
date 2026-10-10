import urllib.parse
from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper
from bs4 import BeautifulSoup
from typing import List

class IsKulturScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "İş Kültür"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        url = f"https://www.iskultur.com.tr/?s={urllib.parse.quote(query)}"
        
        soup = await self.fetch_html(url)
        if not soup:
            return []

        results = []
        items = soup.select(".product, .book-item, .post-item")
        
        for item in items[:3]:
            try:
                title_elem = item.select_one(".product-title, .title, h2, h3")
                title = title_elem.text.strip() if title_elem else ""
                
                author_elem = item.select_one(".product-author, .author")
                author = author_elem.text.strip() if author_elem else ""
                
                publisher = "İş Bankası Kültür Yayınları"
                
                img_elem = item.select_one("img")
                cover_url = img_elem.get("src") if img_elem else ""
                
                if title:
                    results.append(ExternalBookResult(
                        title=title,
                        author=author,
                        publisher=publisher,
                        cover_url=cover_url,
                        source=self.source_name
                    ))
            except Exception as e:
                print(f"Error parsing İş Kültür item: {e}")
                continue
                
        return results
