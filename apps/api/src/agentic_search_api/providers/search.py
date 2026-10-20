"""Web search backends. Add one by implementing SearchProvider and selecting it in dependencies.get_search."""

from typing import Protocol

import httpx

from agentic_search_api.schemas import SearchHit


class SearchProvider(Protocol):
    """Anything that turns a query into ranked hits."""

    async def search(self, query: str, limit: int) -> list[SearchHit]:
        """Returns at most `limit` hits; raises on failure (the pipeline skips that query)."""
        ...


class SearxngSearch:
    """A self-hosted SearXNG instance (meta-search over Google, Bing, DuckDuckGo, ...) via its JSON API.

    Hits carry only the title, URL and snippet; pages themselves are not fetched.
    """

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
            # Drops non-web results (e.g. magnet: or file links) that can't be shown as sources.
            if r.get("url", "").startswith(("http://", "https://"))
        ]


class MockSearch:
    """Offline stand-in: three placeholder hits per query, for tests and running without SearXNG."""

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
