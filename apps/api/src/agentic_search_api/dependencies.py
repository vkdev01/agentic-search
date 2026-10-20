"""FastAPI dependencies that build per-request services from Settings.

Chat models come from the catalog (models.yaml + discovery, see providers/llm/catalog.py): a request
names a model id and get_llm builds that model's adapter. Search backends are chosen in get_search.
"""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import uuid4

import httpx
from fastapi import Depends, HTTPException

from agentic_search_api.config import Settings, get_settings
from agentic_search_api.providers.llm import (
    LLM,
    ModelCatalog,
    ModelSpec,
    UnknownModelError,
    create_llm,
    load_catalog_file,
)
from agentic_search_api.providers.search import MockSearch, SearchProvider, SearxngSearch
from agentic_search_api.schemas import ChatRequest
from agentic_search_api.telemetry import UsageStore, get_usage_store

SettingsDep = Annotated[Settings, Depends(get_settings)]
StoreDep = Annotated[UsageStore, Depends(get_usage_store)]


def get_run_id() -> str:
    """A fresh id per request; every LLM call in the run is stored under it."""
    return uuid4().hex


async def get_http_client() -> AsyncIterator[httpx.AsyncClient]:
    """A per-request HTTP client for search and model discovery, closed when the response finishes."""
    async with httpx.AsyncClient(headers={"User-Agent": "agentic-search/0.1"}) as client:
        yield client


HttpClientDep = Annotated[httpx.AsyncClient, Depends(get_http_client)]


def get_catalog(settings: SettingsDep) -> ModelCatalog:
    """The model catalog from MODELS_FILE (re-read per request, so edits apply without a restart)."""
    return ModelCatalog(load_catalog_file(settings.models_file), settings)


CatalogDep = Annotated[ModelCatalog, Depends(get_catalog)]


def get_chat_request(body: ChatRequest) -> ChatRequest:
    """The chat body, parsed once and shared by the route and get_model."""
    return body


ChatRequestDep = Annotated[ChatRequest, Depends(get_chat_request)]


async def get_model(chat: ChatRequestDep, catalog: CatalogDep, client: HttpClientDep) -> ModelSpec:
    """The requested (or default) model; 400 if it isn't available, before any streaming starts."""
    try:
        return await catalog.resolve(chat.model, client)
    except UnknownModelError as exc:
        raise HTTPException(400, str(exc)) from None


def get_llm(
    spec: Annotated[ModelSpec, Depends(get_model)], store: StoreDep, run_id: Annotated[str, Depends(get_run_id)]
) -> LLM:
    """A fresh adapter for the selected model; its calls are recorded under this request's run id."""
    return create_llm(spec, run_id, store)


def get_search(settings: SettingsDep, client: HttpClientDep) -> SearchProvider:
    """The search backend selected by SEARCH_PROVIDER."""
    if settings.search_provider == "searxng":
        return SearxngSearch(settings.searxng_url, client)
    return MockSearch()
