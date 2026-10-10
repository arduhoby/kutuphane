import re
import json
import httpx
from bs4 import BeautifulSoup
from typing import List, Optional
try:
    from ddgs import DDGS
except ImportError:
    from duckduckgo_search import DDGS

from app.schemas.book import ExternalBookResult
from .base_scraper import BaseScraper

class WebMetaScraper(BaseScraper):
    @property
    def source_name(self) -> str:
        return "Web Meta Search"

    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        if not query:
            return []
            
        results = []
        try:
            # We'll search across reliable e-commerce sites to get structured product pages
            search_query = f"{query} (site:kitapsepeti.com OR site:dr.com.tr OR site:bkmkitap.com OR site:nadirkitap.com)"
            
            urls_to_scrape = []
            
            # Using synchronous DDGS inside async - in a real prod app we'd use a threadpool, 
            # but for this scale it's fine
            with DDGS() as ddgs:
                ddg_res = list(ddgs.text(search_query, max_results=3))
                
                for r in ddg_res:
                    urls_to_scrape.append(r['href'])
                    
            for url in urls_to_scrape:
                try:
                    async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                        headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}
                        res = await client.get(url, headers=headers)
                        if res.status_code == 200:
                            book = self._extract_metadata(res.text, url)
                            if book:
                                results.append(book)
                except Exception as e:
                    print(f"Error fetching {url}: {e}")
                    
        except Exception as e:
            print(f"WebMetaScraper error: {e}")
            
        return results
        
    def _extract_metadata(self, html: str, url: str) -> Optional[ExternalBookResult]:
        soup = BeautifulSoup(html, "html.parser")
        
        # 1. Try to find JSON-LD (Schema.org)
        title = None
        author = None
        cover_url = None
        isbn = None
        publisher = None
        
        for script in soup.find_all("script", type="application/ld+json"):
            try:
                data = json.loads(script.string)
                if isinstance(data, list):
                    for item in data:
                        if item.get("@type") in ["Book", "Product"]:
                            data = item
                            break
                if data.get("@type") in ["Book", "Product"]:
                    if not title: title = data.get("name")
                    
                    if not author and "author" in data:
                        if isinstance(data["author"], dict):
                            author = data["author"].get("name")
                        elif isinstance(data["author"], list) and len(data["author"]) > 0:
                            author = data["author"][0].get("name")
                            
                    if not cover_url:
                        img = data.get("image")
                        if isinstance(img, str): cover_url = img
                        elif isinstance(img, list) and len(img) > 0: cover_url = img[0]
                        
                    if not isbn:
                        isbn = data.get("isbn") or data.get("gtin13") or data.get("sku")
            except:
                pass
                
        # 2. Fallback to Open Graph tags
        if not title:
            og_title = soup.find("meta", property="og:title")
            if og_title: title = og_title.get("content")
        if not cover_url:
            og_img = soup.find("meta", property="og:image")
            if og_img: cover_url = og_img.get("content")
            
        # 3. Fallback to title tag
        if not title and soup.title:
            title = soup.title.string.split("|")[0].split("-")[0].strip()
            
        # 4. Regex for ISBN in HTML (978 followed by 10 digits)
        if not isbn:
            isbn_match = re.search(r'(978[0-9]{10}|978-[0-9\-]{11,14})', html)
            if isbn_match:
                isbn = isbn_match.group(1).replace("-", "")
                
        if title:
            source_domain = urllib.parse.urlparse(url).netloc.replace("www.", "") if "urllib" in globals() else url.split("/")[2].replace("www.", "")
            return ExternalBookResult(
                title=title,
                author=author,
                publisher=publisher,
                cover_url=cover_url,
                isbn=isbn,
                source=f"Web Meta ({source_domain})"
            )
        return None
