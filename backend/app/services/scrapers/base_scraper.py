import httpx
from bs4 import BeautifulSoup
from typing import List, Optional
from abc import ABC, abstractmethod
import asyncio
from app.schemas.book import ExternalBookResult

class BaseScraper(ABC):
    @property
    @abstractmethod
    def source_name(self) -> str:
        pass
        
    @abstractmethod
    async def search(self, query: str, search_type: str = "title") -> List[ExternalBookResult]:
        """
        search_type can be 'title' or 'isbn'
        """
        pass

    async def fetch_html(self, url: str, params: Optional[dict] = None) -> Optional[BeautifulSoup]:
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
                response = await client.get(url, params=params, headers=headers)
                response.raise_for_status()
                return BeautifulSoup(response.text, "html.parser")
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None
