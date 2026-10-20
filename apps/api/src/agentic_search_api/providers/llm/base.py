"""The contract every chat model adapter implements, and the model description adapters are built from.

The agent (agent/pipeline.py) only talks to the LLM protocol, so swapping providers never touches it.
To support a new kind of API, write an adapter that satisfies LLM and register it in factory.py.
"""

from collections.abc import AsyncIterator
from typing import Any, Protocol

from pydantic import BaseModel, SecretStr

from agentic_search_api.telemetry import LLMCallRecord

Message = dict[str, str]
"""An OpenAI-style chat message: `{"role": ..., "content": ...}`."""


class LLM(Protocol):
    """What the agent needs from a model. One instance serves one request, so `records` is per run."""

    model: str
    max_tokens: int | None
    context_window: int | None
    """Prompt + output token limit, for the usage panel; None falls back to Settings.context_window_tokens."""
    price_per_mtok: tuple[float, float] | None
    """(input, output) price per 1M tokens; None falls back to Settings prices."""
    records: list[LLMCallRecord]
    """Calls made during the current request, in order."""

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        """One non-streaming call whose reply must match the JSON `schema`; `name` labels the call."""
        ...

    def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        """Streams the reply's visible text (reasoning is counted but not yielded)."""
        ...


class ModelSpec(BaseModel):
    """One selectable model, resolved from models.yaml (or discovered). Holds secrets: never send it to clients."""

    id: str
    """What clients send to pick this model: `<provider>/<model>` (or `mock`)."""
    provider: str
    provider_label: str
    kind: str
    """Adapter that calls it (factory.ADAPTERS key), e.g. `openai` for any OpenAI-compatible API."""
    model: str
    """The provider's own model name, sent in API requests."""
    label: str
    base_url: str | None = None
    api_key: SecretStr | None = None
    api_key_headers: list[str] = []
    """Extra headers that also carry the API key (e.g. Sarvam's `api-subscription-key`)."""
    local: bool = False
    reasoning: bool = False
    context_window: int | None = None
    max_tokens: int | None = None
    json_extra: dict[str, Any] = {}
    """Extra request fields for planning (JSON) calls."""
    stream_extra: dict[str, Any] = {}
    """Extra request fields for answer (streaming) calls."""
    price_input_per_mtok: float | None = None
    price_output_per_mtok: float | None = None

    @property
    def price_per_mtok(self) -> tuple[float, float] | None:
        if self.price_input_per_mtok is None or self.price_output_per_mtok is None:
            return None
        return (self.price_input_per_mtok, self.price_output_per_mtok)
