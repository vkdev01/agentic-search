import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any, Protocol

from openai import AsyncOpenAI

from agentic_search_api.telemetry import LLMCallRecord, UsageStore

Message = dict[str, str]


class LLM(Protocol):
    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]: ...

    def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]: ...


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


def _reasoning_text(obj: Any) -> str:
    # Servers differ: Sarvam streams `reasoning`, others use `reasoning_content`.
    return getattr(obj, "reasoning_content", None) or getattr(obj, "reasoning", None) or ""


class OpenAICompatibleLLM:
    """Any OpenAI-compatible chat API (Sarvam, Ollama, vLLM, ...). Every call is recorded in `store`."""

    def __init__(
        self,
        *,
        provider: str,
        base_url: str,
        api_key: str,
        model: str,
        run_id: str,
        store: UsageStore | None = None,
        max_tokens: int | None = None,
        default_headers: dict[str, str] | None = None,
        json_extra: dict[str, Any] | None = None,
        stream_extra: dict[str, Any] | None = None,
        http_client: Any = None,
    ) -> None:
        self._client = AsyncOpenAI(
            base_url=base_url, api_key=api_key, default_headers=default_headers, http_client=http_client
        )
        self._provider = provider
        self._model = model
        self._run_id = run_id
        self._store = store
        self._max_tokens = max_tokens
        self._json_extra = json_extra or {}
        self._stream_extra = stream_extra or {}

    def _new_record(self, purpose: str, stream: bool, messages: list[Message], params: dict[str, Any]) -> LLMCallRecord:
        return LLMCallRecord(
            run_id=self._run_id,
            purpose=purpose,
            provider=self._provider,
            model=self._model,
            stream=stream,
            request_params=params,
            input_chars=sum(len(m["content"]) for m in messages),
        )

    def _save(self, record: LLMCallRecord) -> None:
        if self._store:
            self._store.insert(record)

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        params: dict[str, Any] = {"temperature": 0.2, "max_tokens": self._max_tokens, **self._json_extra}
        record = self._new_record(name, stream=False, messages=messages, params={**params, "response_format": name})
        start = time.perf_counter()
        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,  # type: ignore[arg-type]
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": name, "schema": schema, "strict": True},
                },
                temperature=params["temperature"],
                max_tokens=self._max_tokens,
                extra_body=self._json_extra,
            )
            choice = response.choices[0]
            content = choice.message.content or ""
            reasoning = _reasoning_text(choice.message)
            record.response_id = response.id
            record.finish_reason = choice.finish_reason
            record.output_chars = len(content)
            record.reasoning_chars = len(reasoning)
            record.response_meta.update(
                model=response.model, created=response.created, system_fingerprint=response.system_fingerprint
            )
            if response.usage:
                record.set_usage(response.usage)
            return json.loads(content or "{}")
        except Exception as exc:
            record.status, record.error = "error", repr(exc)[:500]
            raise
        finally:
            record.latency_ms = _elapsed_ms(start)
            self._save(record)

    async def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        params: dict[str, Any] = {"temperature": 0.3, "max_tokens": self._max_tokens, **self._stream_extra}
        record = self._new_record(purpose, stream=True, messages=messages, params=params)
        start = time.perf_counter()
        try:
            stream = await self._client.chat.completions.create(
                model=self._model,
                messages=messages,  # type: ignore[arg-type]
                stream=True,
                temperature=params["temperature"],
                max_tokens=self._max_tokens,
                extra_body=self._stream_extra,
            )
            async for chunk in stream:
                record.response_id = record.response_id or chunk.id
                record.response_meta.setdefault("model", chunk.model)
                if chunk.usage:  # final usage-only chunk carries no choices
                    record.set_usage(chunk.usage)
                if not chunk.choices:
                    continue
                choice = chunk.choices[0]
                if choice.finish_reason:
                    record.finish_reason = choice.finish_reason
                if reasoning := _reasoning_text(choice.delta):
                    if record.first_reasoning_ms is None:
                        record.first_reasoning_ms = _elapsed_ms(start)
                    record.reasoning_chars += len(reasoning)
                if text := choice.delta.content:
                    if record.ttft_ms is None:
                        record.ttft_ms = _elapsed_ms(start)
                    record.output_chars += len(text)
                    yield text
        except (asyncio.CancelledError, GeneratorExit):
            record.status = "cancelled"
            raise
        except Exception as exc:
            record.status, record.error = "error", repr(exc)[:500]
            raise
        finally:
            record.latency_ms = _elapsed_ms(start)
            self._save(record)


class MockLLM:
    """Deterministic stand-in so the full pipeline runs without API keys."""

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        question = messages[-1]["content"]
        return {"queries": [question, f"{question} explained", f"{question} latest"]}

    async def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        answer = (
            "This is a **mock answer** from the scaffold. The real model will synthesize the sources "
            "above into a cited response [1][2]. Set `LLM_PROVIDER=sarvam` or `ollama` in `.env` to switch."
        )
        for word in answer.split(" "):
            await asyncio.sleep(0.02)
            yield word + " "
