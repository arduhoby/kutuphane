import asyncio
import sys
import os

sys.path.append(os.getcwd())
from app.services.scrapers.kitapyurdu import KitapyurduScraper
from app.services.scrapers.nadirkitap import NadirkitapScraper
from app.services.scrapers.dr import DrScraper

async def main():
    query = "zamanın kısa tarihi"
    print("Kitapyurdu...")
    k = await KitapyurduScraper().search(query)
    print(f"Kitapyurdu: {len(k)}")
    
    print("Nadirkitap...")
    n = await NadirkitapScraper().search(query)
    print(f"Nadirkitap: {len(n)}")
    
    print("D&R...")
    d = await DrScraper().search(query)
    print(f"D&R: {len(d)}")

if __name__ == "__main__":
    asyncio.run(main())
