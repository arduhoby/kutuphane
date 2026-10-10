from duckduckgo_search import DDGS
with DDGS() as ddgs:
    results = [r for r in ddgs.text("stephen hawking - 1988 zamanın kısa tarihi site:kitapyurdu.com", max_results=3)]
    for r in results:
        print(r)
