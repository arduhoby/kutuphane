import asyncio
import httpx

async def main():
    url = "https://r.jina.ai/https://www.goodreads.com/book/show/3636.A_Brief_History_of_Time"
    headers = {"Accept": "application/json"}
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(url, headers=headers)
        data = res.json()
        print("Title:", data.get('data', {}).get('title'))
        print("Image:", data.get('data', {}).get('image'))
        print("Content:", data.get('data', {}).get('content', '')[:300])

if __name__ == "__main__":
    asyncio.run(main())
