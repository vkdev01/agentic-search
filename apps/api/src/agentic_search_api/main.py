"""HTTP entry point: a health check and the streaming chat endpoint. Run with `make api`."""

import logging
from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.sse import EventSourceResponse, ServerSentEvent

from agentic_search_api.agent.pipeline import run_agent
from agentic_search_api.config import get_settings
from agentic_search_api.dependencies import SettingsDep, get_llm, get_search
from agentic_search_api.providers.llm import LLM
from agentic_search_api.providers.search import SearchProvider
from agentic_search_api.schemas import ChatRequest, ErrorEvent

log = logging.getLogger(__name__)

app = FastAPI(title="Agentic Search API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["GET", "POST"],
    allow_headers=["content-type"],
)


@app.get("/health")
def health(settings: SettingsDep) -> dict[str, str]:
    """Liveness plus the active providers (the web app shows them in the UI)."""
    return {"status": "ok", "llm": settings.llm_provider, "search": settings.search_provider}


@app.post("/api/chat", response_class=EventSourceResponse)
async def chat(
    request: ChatRequest,
    settings: SettingsDep,
    llm: Annotated[LLM, Depends(get_llm)],
    search: Annotated[SearchProvider, Depends(get_search)],
) -> AsyncIterator[ServerSentEvent]:
    """Answers the last message in `request.messages` as a stream of server-sent events.

    Each event's name is its `type` and its data is the JSON event (schemas.AgentEvent).
    Failures mid-stream become a final `error` event with a safe message; details go to the log.
    """
    try:
        async for event in run_agent(request.messages, llm, search, settings, web_search=request.web_search):
            yield ServerSentEvent(event=event.type, data=event)
    except Exception:
        log.exception("Agent run failed")
        error = ErrorEvent(message="Something went wrong while researching. Please try again.")
        yield ServerSentEvent(event=error.type, data=error)
