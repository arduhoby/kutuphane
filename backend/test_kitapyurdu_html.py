import asyncio
import sys
import os
import urllib.parse
import httpx
from bs4 import BeautifulSoup

async def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    query = "zamanın kısa tarihi"
    url = f"https://www.kitapyurdu.com/index.php?route=product/search&filter_name={urllib.parse.quote(query)}"
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(url, headers=headers)
        soup = BeautifulSoup(res.text, "html.parser")
        
        products = soup.select(".product-cr")
        print("product-cr count:", len(products))
        
        products2 = soup.select(".product-list .product-item")
        print("product-item count:", len(products2))
        
        # just print title of the document to see if it's Cloudflare
        print("Title:", soup.title.string if soup.title else "No title")

if __name__ == "__main__":
    asyncio.run(main())
