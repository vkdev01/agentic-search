import asyncio
import json
from collections.abc import AsyncIterator
from typing import Any, Protocol

from openai import AsyncOpenAI

Message = dict[str, str]


class LLM(Protocol):
    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]: ...

    def stream(self, messages: list[Message]) -> AsyncIterator[str]: ...


class OpenAICompatibleLLM:
    """Any OpenAI-compatible chat API (Sarvam, Ollama, vLLM, ...)."""

    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        model: str,
        json_extra: dict[str, Any] | None = None,
        stream_extra: dict[str, Any] | None = None,
    ) -> None:
        self._client = AsyncOpenAI(base_url=base_url, api_key=api_key)
        self._model = model
        self._json_extra = json_extra or {}
        self._stream_extra = stream_extra or {}

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        response = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,  # type: ignore[arg-type]
            response_format={"type": "json_schema", "json_schema": {"name": name, "schema": schema, "strict": True}},
            temperature=0.2,
            extra_body=self._json_extra,
        )
        return json.loads(response.choices[0].message.content or "{}")

    async def stream(self, messages: list[Message]) -> AsyncIterator[str]:
        stream = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,  # type: ignore[arg-type]
            stream=True,
            temperature=0.3,
            extra_body=self._stream_extra,
        )
        async for chunk in stream:
            if chunk.choices and (text := chunk.choices[0].delta.content):
                yield text


class MockLLM:
    """Deterministic stand-in so the full pipeline runs without API keys."""

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        question = messages[-1]["content"]
        return {"queries": [question, f"{question} explained", f"{question} latest"]}

    async def stream(self, messages: list[Message]) -> AsyncIterator[str]:
        answer = (
            "This is a **mock answer** from the scaffold. The real model will synthesize the sources "
            "above into a cited response [1][2]. Set `LLM_PROVIDER=sarvam` or `ollama` in `.env` to switch."
        )
        for word in answer.split(" "):
            await asyncio.sleep(0.02)
            yield word + " "
