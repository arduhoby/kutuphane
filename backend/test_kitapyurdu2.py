import asyncio
import sys
import os
import urllib.parse
import httpx
from bs4 import BeautifulSoup

async def main():
    query = "stephen hawking - 1988 zamanın kısa tarihi"
    url = f"https://www.kitapyurdu.com/index.php?route=product%2Fsearch&filter_name={urllib.parse.quote(query)}"
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(url)
        soup = BeautifulSoup(res.text, "html.parser")
        products = soup.select(".product-cr")
        print(f"Products found in HTML: {len(products)}")
        warning = soup.select_one(".warning, .alert")
        if warning:
            print(f"Warning: {warning.text.strip()}")

if __name__ == "__main__":
    asyncio.run(main())
