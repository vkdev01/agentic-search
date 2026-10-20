"""Offline adapter: a deterministic fake model so the whole app runs without keys or a local model server."""

import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any, Self

from agentic_search_api.providers.llm.base import Message, ModelSpec
from agentic_search_api.telemetry import LLMCallRecord, UsageStore

MOCK_SPEC = ModelSpec(
    id="mock", provider="mock", provider_label="Offline", kind="mock", model="mock", label="Mock (offline demo)"
)
"""Built-in catalog entry, listed unless MOCK_MODEL=false."""


class MockLLM:
    """Plans three canned queries and streams a canned answer. Usage is estimated (~4 chars/token)."""

    model = "mock"
    max_tokens = 2048
    context_window: int | None = None
    price_per_mtok: tuple[float, float] | None = None

    def __init__(self) -> None:
        self.records: list[LLMCallRecord] = []

    @classmethod
    def from_spec(cls, spec: ModelSpec, run_id: str, store: UsageStore | None) -> Self:
        return cls()

    def _record(self, purpose: str, messages: list[Message], output: str) -> None:
        record = LLMCallRecord(
            run_id="mock",
            purpose=purpose,
            provider="mock",
            model=self.model,
            stream=purpose != "search_plan",
            request_params={},
            input_chars=sum(len(m["content"]) for m in messages),
            output_chars=len(output),
            latency_ms=0.0,
        )
        record.prompt_tokens = record.input_chars // 4
        record.completion_tokens = len(output) // 4
        record.total_tokens = record.prompt_tokens + record.completion_tokens
        self.records.append(record)

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        question = messages[-1]["content"].rsplit("\n", 1)[-1]
        result = {"queries": [question, f"{question} explained", f"{question} latest"]}
        self._record(name, messages, json.dumps(result))
        return result

    async def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        answer = (
            "This is a **mock answer**. A real model would synthesize the sources above into a cited "
            "response [1][2]. Pick another model in the composer, or add one in `apps/api/models.yaml`."
        )
        for word in answer.split(" "):
            await asyncio.sleep(0.02)
            yield word + " "
        self._record(purpose, messages, answer)
