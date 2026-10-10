import asyncio
import sys
import os

# Add backend directory to path to import app modules
sys.path.append(os.getcwd())

from app.services.scrapers import search_all_sources

async def main():
    try:
        results = await search_all_sources("yüzüklerin efendisi", "title")
        print(f"Found {len(results)} results.")
        for r in results:
            print(r.title, "-", r.source)
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(main())
