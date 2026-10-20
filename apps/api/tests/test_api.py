import json
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
import respx
from fastapi.testclient import TestClient

from agentic_search_api.config import Settings, get_settings
from agentic_search_api.main import app
from agentic_search_api.providers.search import SearxngSearch
from agentic_search_api.telemetry import UsageStore, get_usage_store


def parse_sse(body: str) -> list[tuple[str, dict]]:
    events = []
    for block in body.strip().split("\n\n"):
        fields = dict(line.split(": ", 1) for line in block.splitlines() if ": " in line)
        if "event" in fields:
            events.append((fields["event"], json.loads(fields["data"])))
    return events


@pytest.fixture
def client(tmp_path: Path) -> Iterator[TestClient]:
    # Ignore the local .env and models.yaml so tests never call real LLM/search services: only the mock model exists.
    app.dependency_overrides[get_settings] = lambda: Settings(
        _env_file=None, models_file=tmp_path / "no-models.yaml", search_provider="mock"
    )
    app.dependency_overrides[get_usage_store] = lambda: UsageStore(tmp_path / "usage.db")
    yield TestClient(app)
    app.dependency_overrides.clear()


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_models_lists_mock_as_default(client: TestClient) -> None:
    body = client.get("/api/models").json()
    assert body["default_model"] == "mock"
    assert [m["id"] for m in body["models"]] == ["mock"]
    assert "api_key" not in body["models"][0] and "base_url" not in body["models"][0]


def test_chat_with_unknown_model_is_rejected_before_streaming(client: TestClient) -> None:
    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hi"}], "model": "nope/missing"})
    assert response.status_code == 400
    assert "not available" in response.json()["detail"]


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

    usage = next(data for name, data in events if name == "usage")
    assert types[-2:] == ["usage", "done"]
    assert [c["purpose"] for c in usage["calls"]] == ["search_plan", "answer"]
    assert usage["context_tokens"] > 0 and usage["breakdown"]["sources"] > 0


def test_chat_rejects_empty_messages(client: TestClient) -> None:
    assert client.post("/api/chat", json={"messages": []}).status_code == 422


def test_follow_up_after_long_answer_is_accepted(client: TestClient) -> None:
    messages = [
        {"role": "user", "content": "compare models"},
        {"role": "assistant", "content": "x" * 10_000},
        {"role": "user", "content": "summarize that in a table"},
    ]
    response = client.post("/api/chat", json={"messages": messages, "web_search": False})
    assert response.status_code == 200


@pytest.mark.parametrize(
    "messages",
    [
        [{"role": "user", "content": "q" * 4001}],
        [{"role": "user", "content": "hi"}, {"role": "assistant", "content": "hello"}],
    ],
)
def test_chat_rejects_invalid_question(client: TestClient, messages: list[dict]) -> None:
    assert client.post("/api/chat", json={"messages": messages}).status_code == 422


def test_chat_without_web_search_skips_planning_and_search(client: TestClient) -> None:
    response = client.post("/api/chat", json={"messages": [{"role": "user", "content": "hello"}], "web_search": False})
    types = [name for name, _ in parse_sse(response.text)]
    assert set(types) == {"token", "usage", "done"} and types[-2:] == ["usage", "done"]


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
