import asyncio
import sys
import os

sys.path.append(os.getcwd())
from app.services.scrapers.google_books import GoogleBooksScraper

async def main():
    scraper = GoogleBooksScraper()
    query = "stephen hawking - 1988 zamanın kısa tarihi"
    results = await scraper.search(query)
    print(f"Found {len(results)} results")
    for r in results:
        print(f"- {r.title} | {r.author} | {r.publisher}")

if __name__ == "__main__":
    asyncio.run(main())
