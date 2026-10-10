import asyncio
import sys
import os
import urllib.parse
import httpx
from bs4 import BeautifulSoup

async def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    query = "zamanın kısa tarihi"
    url = f"https://www.nadirkitap.com/kitapara.php?ara={urllib.parse.quote(query)}"
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(url, headers=headers)
        soup = BeautifulSoup(res.text, "html.parser")
        
        # Any product classes?
        prod_classes = set()
        for tag in soup.find_all(class_=lambda c: c and ('product' in c or 'book' in c or 'item' in c)):
            prod_classes.update(tag.get('class'))
        print("Classes with product/book/item:", prod_classes)
        
        # Is there any a tag with "zaman" in it?
        links = soup.find_all('a', string=lambda text: "zaman" in text.lower() if text else False)
        for link in links:
            print("Link:", link.text.strip(), "Class:", link.get('class'))

if __name__ == "__main__":
    asyncio.run(main())
