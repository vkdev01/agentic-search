"""Adapter for any API that speaks OpenAI Chat Completions: OpenAI, Gemini and Anthropic (via their
OpenAI-compatible endpoints), Groq, Mistral, DeepSeek, OpenRouter, Together, Sarvam, and local servers
such as Ollama, LM Studio and vLLM.
"""

import asyncio
import json
import time
from collections.abc import AsyncIterator
from typing import Any, Self

from openai import AsyncOpenAI

from agentic_search_api.providers.llm.base import Message, ModelSpec
from agentic_search_api.telemetry import LLMCallRecord, UsageStore


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


def _reasoning_text(obj: Any) -> str:
    # Servers differ: Sarvam streams `reasoning`, others use `reasoning_content`.
    return getattr(obj, "reasoning_content", None) or getattr(obj, "reasoning", None) or ""


class OpenAICompatibleLLM:
    """Calls one model on an OpenAI-compatible API. Every call is recorded in `store`.

    `json_extra` / `stream_extra` are passed as extra request fields to the planning and answer calls
    respectively (e.g. Sarvam's `reasoning_effort`). `http_client` lets tests inject a mock transport.
    """

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
        context_window: int | None = None,
        price_per_mtok: tuple[float, float] | None = None,
        default_headers: dict[str, str] | None = None,
        json_extra: dict[str, Any] | None = None,
        stream_extra: dict[str, Any] | None = None,
        http_client: Any = None,
    ) -> None:
        self._client = AsyncOpenAI(
            base_url=base_url, api_key=api_key, default_headers=default_headers, http_client=http_client
        )
        self._provider = provider
        self.model = model
        self._run_id = run_id
        self._store = store
        self.max_tokens = max_tokens
        self.context_window = context_window
        self.price_per_mtok = price_per_mtok
        self.records: list[LLMCallRecord] = []
        self._json_extra = json_extra or {}
        self._stream_extra = stream_extra or {}

    @classmethod
    def from_spec(cls, spec: ModelSpec, run_id: str, store: UsageStore | None) -> Self:
        """Builds the adapter for a catalog model."""
        if not spec.base_url:
            raise ValueError(f"Model {spec.id!r} has no base_url")
        # Local servers ignore the key, but the OpenAI SDK requires a non-empty one.
        key = spec.api_key.get_secret_value() if spec.api_key else "not-needed"
        return cls(
            provider=spec.provider,
            base_url=spec.base_url,
            api_key=key,
            model=spec.model,
            run_id=run_id,
            store=store,
            max_tokens=spec.max_tokens,
            context_window=spec.context_window,
            price_per_mtok=spec.price_per_mtok,
            default_headers={header: key for header in spec.api_key_headers} or None,
            json_extra=spec.json_extra,
            stream_extra=spec.stream_extra,
        )

    def _limits(self) -> dict[str, Any]:
        # Omitted rather than null when unset: some servers reject `max_tokens: null`.
        return {"max_tokens": self.max_tokens} if self.max_tokens is not None else {}

    def _new_record(self, purpose: str, stream: bool, messages: list[Message], params: dict[str, Any]) -> LLMCallRecord:
        return LLMCallRecord(
            run_id=self._run_id,
            purpose=purpose,
            provider=self._provider,
            model=self.model,
            stream=stream,
            request_params=params,
            input_chars=sum(len(m["content"]) for m in messages),
        )

    def _save(self, record: LLMCallRecord) -> None:
        self.records.append(record)
        if self._store:
            self._store.insert(record)

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        params: dict[str, Any] = {"temperature": 0.2, **self._limits(), **self._json_extra}
        record = self._new_record(name, stream=False, messages=messages, params={**params, "response_format": name})
        start = time.perf_counter()
        try:
            response = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                response_format={
                    "type": "json_schema",
                    "json_schema": {"name": name, "schema": schema, "strict": True},
                },
                temperature=params["temperature"],
                extra_body={**self._limits(), **self._json_extra},
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
        params: dict[str, Any] = {"temperature": 0.3, **self._limits(), **self._stream_extra}
        record = self._new_record(purpose, stream=True, messages=messages, params=params)
        start = time.perf_counter()
        try:
            stream = await self._client.chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                stream=True,
                stream_options={"include_usage": True},
                temperature=params["temperature"],
                extra_body={**self._limits(), **self._stream_extra},
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
