import asyncio
import sys
import os
import urllib.parse

sys.path.append(os.getcwd())
from app.services.scrapers.kitapyurdu import KitapyurduScraper

async def main():
    scraper = KitapyurduScraper()
    query = "stephen hawking - 1988 zamanın kısa tarihi"
    print(f"URL: https://www.kitapyurdu.com/index.php?route=product%2Fsearch&filter_name={urllib.parse.quote(query)}")
    
    results = await scraper.search(query)
    print(f"Found {len(results)} results")
    for r in results:
        print(f"- {r.title} | {r.author} | {r.publisher}")

if __name__ == "__main__":
    asyncio.run(main())
