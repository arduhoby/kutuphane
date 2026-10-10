import asyncio
import sys
import os
import urllib.parse
from app.services.scrapers import search_all_sources

async def main():
    query = "zamanın kısa tarihi"
    results = await search_all_sources(query, "title")
    print(f"Found {len(results)} results")
    for r in results:
        print(f"{r.title} - {r.source}")

if __name__ == "__main__":
    asyncio.run(main())
