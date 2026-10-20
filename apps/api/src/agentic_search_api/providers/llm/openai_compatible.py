"""Adapter for any API that speaks OpenAI Chat Completions: OpenAI, Gemini and Anthropic (via their
OpenAI-compatible endpoints), Groq, Mistral, DeepSeek, OpenRouter, Together, Sarvam, and local servers
such as Ollama, LM Studio and vLLM.
"""

import asyncio
import json
import re
import time
from collections.abc import AsyncIterator
from typing import Any, Self

from openai import APIConnectionError, APIStatusError, AsyncOpenAI

from agentic_search_api.providers.llm.base import Message, ModelSpec
from agentic_search_api.telemetry import LLMCallRecord, UsageStore

# Statuses a server returns when it rejects `response_format` (vs auth, rate limit or outage errors).
_UNSUPPORTED_REQUEST_STATUSES = {400, 404, 422, 501}
# Worth retrying with the SDK's backoff, along with other 5xx.
_TRANSIENT_STATUSES = {408, 409, 429}

_prompt_json_models: set[tuple[str, str]] = set()
"""(base_url, model) pairs known to reject structured output; they go straight to prompt-based JSON."""


def _elapsed_ms(start: float) -> float:
    return round((time.perf_counter() - start) * 1000, 1)


def _reasoning_text(obj: Any) -> str:
    # Servers differ: Sarvam streams `reasoning`, others use `reasoning_content`.
    return getattr(obj, "reasoning_content", None) or getattr(obj, "reasoning", None) or ""


def parse_json_object(text: str) -> dict[str, Any]:
    """The JSON object in a model reply, tolerating code fences or prose around it."""
    text = re.sub(r"^\s*```(?:json)?\s*|\s*```\s*$", "", text.strip())
    try:
        value = json.loads(text or "{}")
    except json.JSONDecodeError:
        start, end = text.find("{"), text.rfind("}")
        if start == -1 or end <= start:
            raise
        value = json.loads(text[start : end + 1])
    if not isinstance(value, dict):
        raise ValueError("Expected a JSON object")
    return value


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
        """Asks for strict structured output; if the server rejects that (some local runtimes can't do it),
        retries with the schema in the prompt and parses the reply leniently. Each attempt is recorded.
        """
        key = (str(self._client.base_url), self.model)
        if key not in _prompt_json_models:
            try:
                # No SDK retries here: they would repeat a 501 "unsupported" pointlessly before the fallback.
                fail_fast = self._client.with_options(max_retries=0)
                return await self._json_call(messages, name, schema=schema, client=fail_fast)
            except APIStatusError as exc:
                if exc.status_code in _UNSUPPORTED_REQUEST_STATUSES:
                    _prompt_json_models.add(key)
                elif exc.status_code in _TRANSIENT_STATUSES or exc.status_code >= 500:
                    return await self._json_call(messages, name, schema=schema)
                else:
                    raise
            except APIConnectionError:
                return await self._json_call(messages, name, schema=schema)
        instruction = (
            f"\n\nReply with only a JSON object (no prose, no code fences) matching this schema:\n{json.dumps(schema)}"
        )
        prompted = [*messages[:-1], {**messages[-1], "content": messages[-1]["content"] + instruction}]
        return await self._json_call(prompted, name, schema=None)

    async def _json_call(
        self, messages: list[Message], name: str, schema: dict[str, Any] | None, client: AsyncOpenAI | None = None
    ) -> dict[str, Any]:
        """One recorded non-streaming call; `schema` set means structured output, None means prompt-only JSON."""
        params: dict[str, Any] = {"temperature": 0.2, **self._limits(), **self._json_extra}
        mode = "json_schema" if schema is not None else "prompt"
        record = self._new_record(name, stream=False, messages=messages, params={**params, "response_format": mode})
        start = time.perf_counter()
        try:
            response = await (client or self._client).chat.completions.create(
                model=self.model,
                messages=messages,  # type: ignore[arg-type]
                **(
                    {
                        "response_format": {
                            "type": "json_schema",
                            "json_schema": {"name": name, "schema": schema, "strict": True},
                        }
                    }
                    if schema is not None
                    else {}
                ),
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
            return parse_json_object(content)
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
