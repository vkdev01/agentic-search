"""FastAPI dependencies that build per-request services from Settings.

This is the one place providers are chosen: to add an LLM or search backend, implement the protocol
in providers/ and add a branch to get_llm or get_search (plus its option in config.Settings).
"""

from collections.abc import AsyncIterator
from typing import Annotated
from uuid import uuid4

import httpx
from fastapi import Depends, HTTPException

from agentic_search_api.config import Settings, get_settings
from agentic_search_api.providers.llm import LLM, MockLLM, OpenAICompatibleLLM
from agentic_search_api.providers.search import MockSearch, SearchProvider, SearxngSearch
from agentic_search_api.telemetry import UsageStore, get_usage_store

SettingsDep = Annotated[Settings, Depends(get_settings)]
StoreDep = Annotated[UsageStore, Depends(get_usage_store)]


def get_run_id() -> str:
    """A fresh id per request; every LLM call in the run is stored under it."""
    return uuid4().hex


def get_llm(settings: SettingsDep, store: StoreDep, run_id: Annotated[str, Depends(get_run_id)]) -> LLM:
    """The model selected by LLM_PROVIDER; 503 if that provider isn't configured."""
    match settings.llm_provider:
        case "sarvam":
            if not settings.sarvam_api_key:
                raise HTTPException(503, "SARVAM_API_KEY is not configured")
            key = settings.sarvam_api_key.get_secret_value()
            return OpenAICompatibleLLM(
                provider="sarvam",
                base_url=settings.sarvam_base_url,
                api_key=key,
                default_headers={"api-subscription-key": key},
                model=settings.sarvam_model,
                run_id=run_id,
                store=store,
                max_tokens=settings.sarvam_max_tokens,
                # Planning is a small JSON task, so skip reasoning there.
                json_extra={"reasoning_effort": None},
                stream_extra={"reasoning_effort": settings.sarvam_reasoning_effort},
            )
        case "ollama":
            if not settings.ollama_model:
                raise HTTPException(503, "OLLAMA_MODEL is not configured")
            return OpenAICompatibleLLM(
                provider="ollama",
                base_url=settings.ollama_base_url,
                api_key="ollama",
                model=settings.ollama_model,
                run_id=run_id,
                store=store,
            )
        case _:
            return MockLLM()


async def get_http_client() -> AsyncIterator[httpx.AsyncClient]:
    """A per-request HTTP client for search calls, closed when the response finishes."""
    async with httpx.AsyncClient(headers={"User-Agent": "agentic-search/0.1"}) as client:
        yield client


def get_search(settings: SettingsDep, client: Annotated[httpx.AsyncClient, Depends(get_http_client)]) -> SearchProvider:
    """The search backend selected by SEARCH_PROVIDER."""
    if settings.search_provider == "searxng":
        return SearxngSearch(settings.searxng_url, client)
    return MockSearch()
