import asyncio
import httpx
import json

async def main():
    query = "zamanın kısa tarihi"
    try:
        from ddgs import DDGS
    except:
        from duckduckgo_search import DDGS

    with DDGS() as ddgs:
        results = [r for r in ddgs.text(f"{query} site:goodreads.com/book/show", max_results=1)]
        
    if not results:
        print("No GR results")
        return
        
    url = results[0]['href']
    print("Found Goodreads URL:", url)
    
    jina_url = f"https://r.jina.ai/{url}"
    headers = {"Accept": "application/json"}
    
    async with httpx.AsyncClient(timeout=30.0) as client:
        res = await client.get(jina_url, headers=headers)
        data = res.json()
        
    content = data.get('data', {}).get('content', '')
    
    print("Markdown length:", len(content))
    print(content[:500])

if __name__ == "__main__":
    asyncio.run(main())
