import json

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from agentic_search_api.main import app
from agentic_search_api.providers.search import SearxngSearch


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in fields:
            events.append((fields["event"], json.loads(fields["data"])))
    return events


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_chat_streams_full_pipeline_with_mocks(client: TestClient) -> None:
    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "what is MCP"}]})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = parse_sse(response.text)
    types = [name for name, _ in events]
    assert types[0] == "plan"
    assert "sources" in types and types[-1] == "done"
    assert types.index("sources") < types.index("token")

    sources = next(data for name, data in events if name == "sources")["sources"]
    assert [s["id"] for s in sources] == list(range(1, len(sources) + 1))
    assert len({s["url"] for s in sources}) == len(sources)


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    assert client.post("/api/chat", json={"messages": []}).status_code == 422


@respx.mock
async def test_searxng_parses_and_filters_results() -> None:
    respx.get("http://searx.test/search").mock(
        return_value=httpx.Response(
            200,
            json={
                "results": [
                    {"title": "A", "url": "https://a.example", "content": "alpha"},
                    {"title": "Bad", "url": "javascript:alert(1)"},
                    {"title": "B", "url": "https://b.example"},
                ]
            },
        )
    )
    async with httpx.AsyncClient() as http:
        hits = await SearxngSearch("http://searx.test", http).search("q", limit=5)
    assert [h.url for h in hits] == ["https://a.example", "https://b.example"]
    assert hits[0].snippet == "alpha"
