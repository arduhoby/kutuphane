import asyncio
import sys
import os
import urllib.parse
import httpx
from bs4 import BeautifulSoup

async def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"}
    query = "zamanın kısa tarihi"
    url = f"https://www.dr.com.tr/search?q={urllib.parse.quote(query)}"
    
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(url, headers=headers)
        soup = BeautifulSoup(res.text, "html.parser")
        
        links = soup.find_all('a', string=lambda text: "zaman" in text.lower() if text else False)
        for link in links:
            print("Link:", link.text.strip(), "Class:", link.get('class'))

if __name__ == "__main__":
    asyncio.run(main())
