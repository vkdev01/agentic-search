from collections.abc import AsyncIterator
from typing import Annotated

import httpx
from fastapi import Depends, HTTPException

from agentic_search_api.config import Settings, get_settings
from agentic_search_api.providers.llm import LLM, MockLLM, OpenAICompatibleLLM
from agentic_search_api.providers.search import MockSearch, SearchProvider, SearxngSearch

SettingsDep = Annotated[Settings, Depends(get_settings)]


def get_llm(settings: SettingsDep) -> LLM:
    match settings.llm_provider:
        case "sarvam":
            if not settings.sarvam_api_key:
                raise HTTPException(503, "SARVAM_API_KEY is not configured")
            return OpenAICompatibleLLM(
                base_url=settings.sarvam_base_url,
                api_key=settings.sarvam_api_key.get_secret_value(),
                model=settings.sarvam_model,
                # Sarvam reasons by default; skip it for the quick JSON planning step.
                json_extra={"reasoning_effort": None},
                stream_extra={"reasoning_effort": "low"},
            )
        case "ollama":
            if not settings.ollama_model:
                raise HTTPException(503, "OLLAMA_MODEL is not configured")
            return OpenAICompatibleLLM(base_url=settings.ollama_base_url, api_key="ollama", model=settings.ollama_model)
        case _:
            return MockLLM()


async def get_http_client() -> AsyncIterator[httpx.AsyncClient]:
    async with httpx.AsyncClient(headers={"User-Agent": "agentic-search/0.1"}) as client:
        yield client


def get_search(settings: SettingsDep, client: Annotated[httpx.AsyncClient, Depends(get_http_client)]) -> SearchProvider:
    if settings.search_provider == "searxng":
        return SearxngSearch(settings.searxng_url, client)
    return MockSearch()
