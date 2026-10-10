import asyncio
import httpx

async def main():
    url = "https://r.jina.ai/https://www.kitapyurdu.com/kitap/zamanin-kisa-tarihi/315441.html"
    headers = {"Accept": "application/json"} # get json so we can see metadata easily
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers=headers)
        data = res.json()
        print("Data keys:", data['data'].keys() if 'data' in data else 'none')
        print("Title:", data.get('data', {}).get('title'))
        print("Image:", data.get('data', {}).get('image'))
        print("Content sample:", data.get('data', {}).get('content', '')[:300])

if __name__ == "__main__":
    asyncio.run(main())
