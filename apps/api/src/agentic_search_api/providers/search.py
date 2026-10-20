from typing import Protocol

import httpx

from agentic_search_api.schemas import SearchHit


class SearchProvider(Protocol):
    async def search(self, query: str, limit: int) -> list[SearchHit]: ...


class SearxngSearch:
    def __init__(self, base_url: str, client: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/")
        self._client = client

    async def search(self, query: str, limit: int) -> list[SearchHit]:
        response = await self._client.get(f"{self._base_url}/search", params={"q": query, "format": "json"}, timeout=10)
        response.raise_for_status()
        results = response.json().get("results", [])
        return [
            SearchHit(title=r.get("title") or r["url"], url=r["url"], snippet=r.get("content") or "")
            for r in results[:limit]
            if r.get("url", "").startswith(("http://", "https://"))
        ]


class MockSearch:
    async def search(self, query: str, limit: int) -> list[SearchHit]:
        slug = "-".join(query.lower().split())[:40]
        return [
            SearchHit(
                title=f"Result {i + 1} for “{query}”",
                url=f"https://example.com/{slug}/{i + 1}",
                snippet=f"Placeholder snippet {i + 1} about {query}.",
            )
            for i in range(min(limit, 3))
        ]
