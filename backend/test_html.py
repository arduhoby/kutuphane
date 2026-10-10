import asyncio
import sys
import os
import urllib.parse
import httpx

async def main():
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    query = "zamanın kısa tarihi"
    
    print("Kitapyurdu URL: ", f"https://www.kitapyurdu.com/index.php?route=product/search&filter_name={urllib.parse.quote(query)}")
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(f"https://www.kitapyurdu.com/index.php?route=product/search&filter_name={urllib.parse.quote(query)}", headers=headers)
        print("Kitapyurdu len:", len(res.text))
        
    print("Nadirkitap URL: ", f"https://www.nadirkitap.com/kitapara.php?ara={urllib.parse.quote(query)}")
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(f"https://www.nadirkitap.com/kitapara.php?ara={urllib.parse.quote(query)}", headers=headers)
        print("Nadirkitap len:", len(res.text))

    print("D&R URL: ", f"https://www.dr.com.tr/search?q={urllib.parse.quote(query)}")
    async with httpx.AsyncClient(follow_redirects=True) as client:
        res = await client.get(f"https://www.dr.com.tr/search?q={urllib.parse.quote(query)}", headers=headers)
        print("D&R len:", len(res.text))

if __name__ == "__main__":
    asyncio.run(main())
