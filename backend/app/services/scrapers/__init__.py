from .base_scraper import BaseScraper
from .google_books import GoogleBooksScraper
from .kitapsepeti import KitapsepetiScraper
from .dogan_kitap import DoganKitapScraper
from .is_kultur import IsKulturScraper
from .yky import YkyScraper
from .web_meta_scraper import WebMetaScraper
import asyncio

SCRAPERS = [
    GoogleBooksScraper(),
    KitapsepetiScraper(),
    DoganKitapScraper(),
    IsKulturScraper(),
    YkyScraper(),
    WebMetaScraper(),
]

async def search_all_sources(query: str, search_type: str = "title"):
    results = []
    # Run all scrapers concurrently
    tasks = [scraper.search(query, search_type) for scraper in SCRAPERS]
    responses = await asyncio.gather(*tasks, return_exceptions=True)
    
    for res in responses:
        if isinstance(res, list):
            results.extend(res)
            
    return results
