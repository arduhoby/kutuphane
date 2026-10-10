import asyncio
from duckduckgo_search import AsyncDDGS

async def main():
    async with AsyncDDGS() as ddgs:
        results = await ddgs.text("stephen hawking - 1988 zamanın kısa tarihi site:kitapyurdu.com", max_results=3)
        print("Results:")
        for r in results:
            print(r)

if __name__ == "__main__":
    asyncio.run(main())
