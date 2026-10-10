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
        
        # let's look for any a tag containing "Zamanın Kısa Tarihi"
        links = soup.find_all('a', string=lambda text: "Zamanın" in text if text else False)
        for link in links:
            print("Link parent class:", link.parent.get('class'))
            print("Link class:", link.get('class'))
            
        print("---")
        # Just grab the class of a generic product div if we can find one.
        grids = soup.select(".product-grid, .product-list, #product-table, .product-info")
        for g in grids:
            print("Grid class:", g.get('class'))
            
        # check anything with product in class
        prod_classes = set()
        for tag in soup.find_all(class_=lambda c: c and 'product' in c):
            prod_classes.update(tag.get('class'))
        print("Classes with 'product':", prod_classes)

if __name__ == "__main__":
    asyncio.run(main())
