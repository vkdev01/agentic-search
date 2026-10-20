import json
import sqlite3
from collections.abc import Callable
from pathlib import Path

import httpx
import openai
import pytest

from agentic_search_api.providers.llm import OpenAICompatibleLLM
from agentic_search_api.telemetry import UsageStore

BASE = "http://llm.test/v1"
USAGE = {
    "prompt_tokens": 40,
    "completion_tokens": 25,
    "total_tokens": 65,
    "completion_tokens_details": {"reasoning_tokens": 15},
    "prompt_tokens_details": {"cached_tokens": 8},
}


def sse(*payloads: dict) -> str:
    return "".join(f"data: {json.dumps(p)}\n\n" for p in payloads) + "data: [DONE]\n\n"


def chunk(delta: dict, finish_reason: str | None = None) -> dict:
    return {
        "id": "resp-1",
        "object": "chat.completion.chunk",
        "created": 1,
        "model": "sarvam-105b",
        "choices": [{"index": 0, "delta": delta, "finish_reason": finish_reason}],
    }


@pytest.fixture
def store(tmp_path: Path) -> UsageStore:
    return UsageStore(tmp_path / "usage.db")


def rows(store: UsageStore) -> list[sqlite3.Row]:
    with sqlite3.connect(store.path) as conn:
        conn.row_factory = sqlite3.Row
        return conn.execute("SELECT * FROM llm_calls ORDER BY id").fetchall()


def make_llm(store: UsageStore, respond: Callable[[httpx.Request], httpx.Response]) -> OpenAICompatibleLLM:
    # The OpenAI SDK accepts a plain httpx client, so a MockTransport stands in for the network.
    return OpenAICompatibleLLM(
        provider="sarvam",
        base_url=BASE,
        api_key="test-key",
        default_headers={"api-subscription-key": "test-key"},
        model="sarvam-105b",
        run_id="run-1",
        store=store,
        max_tokens=1024,
        stream_extra={"reasoning_effort": "low"},
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(respond)),
    )


async def test_stream_records_usage_latency_and_skips_reasoning_text(store: UsageStore) -> None:
    requests: list[httpx.Request] = []

    def respond(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            headers={"content-type": "text/event-stream"},
            text=sse(
                chunk({"role": "assistant", "reasoning": "thinking..."}),
                chunk({"content": "Hello "}),
                chunk({"content": "world"}, finish_reason="stop"),
                {
                    "id": "resp-1",
                    "object": "chat.completion.chunk",
                    "created": 1,
                    "model": "sarvam-105b",
                    "choices": [],
                    "usage": USAGE,
                },
            ),
        )

    llm = make_llm(store, respond)
    text = "".join([t async for t in llm.stream([{"role": "user", "content": "hi"}])])

    assert text == "Hello world"
    request = requests[-1]
    assert request.headers["api-subscription-key"] == "test-key"
    body = json.loads(request.content)
    assert body["stream"] is True and body["reasoning_effort"] == "low" and body["max_tokens"] == 1024

    [row] = rows(store)
    assert (row["run_id"], row["purpose"], row["status"], row["finish_reason"]) == ("run-1", "answer", "ok", "stop")
    assert (row["prompt_tokens"], row["completion_tokens"], row["reasoning_tokens"], row["cached_tokens"]) == (
        40,
        25,
        15,
        8,
    )
    assert row["output_chars"] == len("Hello world") and row["reasoning_chars"] == len("thinking...")
    assert row["latency_ms"] >= row["ttft_ms"] >= row["first_reasoning_ms"] >= 0
    assert json.loads(row["response_meta"])["usage"]["total_tokens"] == 65


async def test_json_call_records_usage(store: UsageStore) -> None:
    def respond(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "id": "resp-2",
                "object": "chat.completion",
                "created": 1,
                "model": "sarvam-105b",
                "choices": [
                    {
                        "index": 0,
                        "finish_reason": "stop",
                        "message": {"role": "assistant", "content": '{"queries": ["a", "b"]}'},
                    }
                ],
                "usage": USAGE,
            },
        )

    llm = make_llm(store, respond)
    result = await llm.complete_json([{"role": "user", "content": "q"}], {"type": "object"}, "search_plan")

    assert result == {"queries": ["a", "b"]}
    [row] = rows(store)
    assert (row["purpose"], row["stream"], row["response_id"], row["total_tokens"]) == ("search_plan", 0, "resp-2", 65)


async def test_failed_call_is_recorded_as_error(store: UsageStore) -> None:
    llm = make_llm(store, lambda request: httpx.Response(422, json={"error": {"message": "bad"}}))

    with pytest.raises(openai.APIStatusError):
        await llm.complete_json([{"role": "user", "content": "q"}], {"type": "object"}, "search_plan")

    [row] = rows(store)
    assert row["status"] == "error" and "422" in row["error"]
