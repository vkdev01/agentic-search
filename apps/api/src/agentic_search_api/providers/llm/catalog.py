"""The model catalog: which models the UI can pick, built from models.yaml plus live discovery.

A provider is enabled when it needs no API key or its `api_key_env` is set (environment or .env).
Its models are the ones listed in models.yaml, plus, with `discover: true`, everything its
OpenAI-compatible `GET /models` endpoint returns (e.g. every model you've pulled into Ollama).
"""

import fnmatch
import logging
import time
from pathlib import Path
from typing import Any

import httpx
import yaml
from pydantic import BaseModel, SecretStr

from agentic_search_api.config import Settings
from agentic_search_api.providers.llm.base import ModelSpec
from agentic_search_api.providers.llm.mock import MOCK_SPEC

log = logging.getLogger(__name__)

DISCOVERY_TTL_S = 60
DISCOVERY_TIMEOUT_S = 3

_discovered: dict[str, tuple[float, list[str]]] = {}
"""Discovered model names per provider base URL, with fetch time; shared across requests."""


class ModelEntry(BaseModel):
    """A model listed under a provider in models.yaml; unset fields fall back to the provider's."""

    id: str
    label: str | None = None
    context_window: int | None = None
    max_tokens: int | None = None
    reasoning: bool = False
    json_extra: dict[str, Any] | None = None
    stream_extra: dict[str, Any] | None = None
    price_input_per_mtok: float | None = None
    price_output_per_mtok: float | None = None


class ProviderEntry(BaseModel):
    """One provider in models.yaml (field docs are in the file's header)."""

    label: str | None = None
    kind: str = "openai"
    base_url: str | None = None
    base_url_env: str | None = None
    api_key_env: str | None = None
    api_key_headers: list[str] = []
    local: bool = False
    discover: bool = False
    include: list[str] = []
    context_window: int | None = None
    max_tokens: int | None = None
    json_extra: dict[str, Any] = {}
    stream_extra: dict[str, Any] = {}
    models: list[ModelEntry] = []


class CatalogFile(BaseModel):
    default_model: str | None = None
    providers: dict[str, ProviderEntry] = {}


class UnknownModelError(LookupError):
    """The requested model id isn't available (not configured, missing its key, or not installed)."""


def load_catalog_file(path: Path) -> CatalogFile:
    """Parses models.yaml; a missing file means no configured providers (only the mock model)."""
    if not path.exists():
        log.warning("Model catalog %s not found; only the mock model is available", path)
        return CatalogFile()
    return CatalogFile.model_validate(yaml.safe_load(path.read_text()) or {})


def _spec(name: str, provider: ProviderEntry, base_url: str | None, key: str | None, entry: ModelEntry) -> ModelSpec:
    # Local models are free unless priced explicitly, so they never inherit the global prices.
    free = 0.0 if provider.local else None
    return ModelSpec(
        id=f"{name}/{entry.id}",
        provider=name,
        provider_label=provider.label or name,
        kind=provider.kind,
        model=entry.id,
        label=entry.label or entry.id,
        base_url=base_url,
        api_key=SecretStr(key) if key else None,
        api_key_headers=provider.api_key_headers,
        local=provider.local,
        reasoning=entry.reasoning,
        context_window=entry.context_window or provider.context_window,
        max_tokens=entry.max_tokens or provider.max_tokens,
        json_extra=provider.json_extra if entry.json_extra is None else entry.json_extra,
        stream_extra=provider.stream_extra if entry.stream_extra is None else entry.stream_extra,
        price_input_per_mtok=entry.price_input_per_mtok if entry.price_input_per_mtok is not None else free,
        price_output_per_mtok=entry.price_output_per_mtok if entry.price_output_per_mtok is not None else free,
    )


async def _discover(client: httpx.AsyncClient, base_url: str, key: str | None) -> list[str]:
    """Model names from `GET {base_url}/models`, cached for DISCOVERY_TTL_S; [] if the server is unreachable."""
    cached = _discovered.get(base_url)
    if cached and time.monotonic() - cached[0] < DISCOVERY_TTL_S:
        return cached[1]
    headers = {"Authorization": f"Bearer {key}"} if key else {}
    try:
        response = await client.get(f"{base_url.rstrip('/')}/models", headers=headers, timeout=DISCOVERY_TIMEOUT_S)
        response.raise_for_status()
        names = sorted(str(m["id"]) for m in response.json().get("data", []) if m.get("id"))
    except (httpx.HTTPError, ValueError, KeyError, AttributeError) as exc:
        log.info("Model discovery failed for %s: %s", base_url, exc)
        names = []
    _discovered[base_url] = (time.monotonic(), names)
    return names


class ModelCatalog:
    """Resolves model ids to ModelSpecs for one request. Cheap to build; discovery results are cached."""

    def __init__(self, config: CatalogFile, settings: Settings) -> None:
        self._config = config
        self._settings = settings

    async def models(self, client: httpx.AsyncClient) -> list[ModelSpec]:
        """Every available model, providers in file order, with the mock model last."""
        specs: list[ModelSpec] = []
        for name, provider in self._config.providers.items():
            key = self._settings.env_value(provider.api_key_env) if provider.api_key_env else None
            if provider.api_key_env and not key:
                continue  # provider needs a key that isn't set
            base_url = (provider.base_url_env and self._settings.env_value(provider.base_url_env)) or provider.base_url
            listed = {entry.id: entry for entry in provider.models}
            if provider.discover and base_url:
                for model_name in await _discover(client, base_url, key):
                    if model_name not in listed and (
                        not provider.include or any(fnmatch.fnmatch(model_name, p) for p in provider.include)
                    ):
                        listed[model_name] = ModelEntry(id=model_name)
            specs.extend(_spec(name, provider, base_url, key, entry) for entry in listed.values())
        if self._settings.mock_model:
            specs.append(MOCK_SPEC)
        return specs

    async def default_id(self, client: httpx.AsyncClient) -> str | None:
        """DEFAULT_MODEL, else the file's default_model, else the first available model (if those are unavailable)."""
        available = [spec.id for spec in await self.models(client)]
        for candidate in (self._settings.default_model, self._config.default_model):
            if candidate in available:
                return candidate
        return available[0] if available else None

    async def resolve(self, model_id: str | None, client: httpx.AsyncClient) -> ModelSpec:
        """The spec for `model_id`, or the default model when it's None."""
        specs = await self.models(client)
        wanted = model_id or await self.default_id(client)
        for spec in specs:
            if spec.id == wanted:
                return spec
        raise UnknownModelError(f"Model {wanted!r} is not available" if wanted else "No models are configured")
