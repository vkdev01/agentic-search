"""Builds the right adapter for a catalog model, keyed by the model's `kind`.

To support an API that isn't OpenAI-compatible (e.g. Anthropic's native Messages API), write an adapter
class with a `from_spec(spec, run_id, store)` classmethod that satisfies base.LLM, add it to ADAPTERS,
and use its kind in models.yaml.
"""

from collections.abc import Callable

from agentic_search_api.providers.llm.base import LLM, ModelSpec
from agentic_search_api.providers.llm.mock import MockLLM
from agentic_search_api.providers.llm.openai_compatible import OpenAICompatibleLLM
from agentic_search_api.telemetry import UsageStore

AdapterFactory = Callable[[ModelSpec, str, UsageStore | None], LLM]

ADAPTERS: dict[str, AdapterFactory] = {
    "openai": OpenAICompatibleLLM.from_spec,
    "mock": MockLLM.from_spec,
}


def create_llm(spec: ModelSpec, run_id: str, store: UsageStore | None) -> LLM:
    """A fresh adapter for one request; `run_id` groups its calls in the usage DB."""
    try:
        factory = ADAPTERS[spec.kind]
    except KeyError:
        raise ValueError(f"Model {spec.id!r} uses unknown adapter kind {spec.kind!r}") from None
    return factory(spec, run_id, store)
