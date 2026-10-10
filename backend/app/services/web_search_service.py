from ddgs import DDGS
from typing import Optional


async def search_web(query: str, max_results: int = 5) -> list[dict]:
    try:
        with DDGS() as ddgs:
            results = list(ddgs.text(query, max_results=max_results))
            return [
                {
                    "title": r.get("title", ""),
                    "snippet": r.get("body", ""),
                    "url": r.get("href", ""),
                }
                for r in results
            ]
    except Exception:
        return []


def format_search_context(results: list[dict]) -> str:
    if not results:
        return ""
    lines = []
    for i, r in enumerate(results[:5], 1):
        snippet = r.get("snippet", "")[:400]
        url = r.get("url", "")
        lines.append(f"[{i}] {r.get('title', '')}")
        lines.append(f"    Link: {url}")
        lines.append(f"    {snippet}")
    return "\n".join(lines)
