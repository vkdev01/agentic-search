"""Runs one chat request end to end and streams its progress as AgentEvents.

    plan_queries (planner.py)  ->  search every query in parallel  ->  build_sources (sources.py)
    ->  stream the answer with the sources in the system prompt  ->  usage (usage.py)  ->  done

With web search off, or when the planner decides a follow-up needs no new search, the run skips
straight to streaming an answer with a different system prompt (prompts.py).
"""

import asyncio
import logging
from collections.abc import AsyncIterator

from agentic_search_api.agent.planner import plan_queries
from agentic_search_api.agent.prompts import ANSWER_PROMPT, DIRECT_PROMPT, FOLLOW_UP_PROMPT, chat_messages
from agentic_search_api.agent.sources import build_sources, sources_block
from agentic_search_api.agent.usage import usage_event
from agentic_search_api.config import Settings
from agentic_search_api.providers.llm import LLM, Message
from agentic_search_api.providers.search import SearchProvider
from agentic_search_api.schemas import (
    AgentEvent,
    ChatMessage,
    DoneEvent,
    PlanEvent,
    SearchEvent,
    SearchHit,
    SourcesEvent,
    TokenEvent,
)

log = logging.getLogger(__name__)


async def stream_answer(
    llm: LLM, settings: Settings, messages: list[Message], purpose: str, sources_chars: int = 0
) -> AsyncIterator[AgentEvent]:
    """Streams the answer as token events, then the run's usage event and `done`.

    `purpose` labels the call in the usage DB (answer, follow_up, chat).
    """
    async for text in llm.stream(messages, purpose=purpose):
        yield TokenEvent(text=text)
    yield usage_event(llm, settings, messages, sources_chars)
    yield DoneEvent()


async def search_all(
    queries: list[str], search: SearchProvider, limit: int
) -> tuple[list[SearchEvent], list[tuple[str, SearchHit]]]:
    """Runs every query concurrently; returns a `done`/`failed` event per query and all `(query, hit)` pairs.

    A failed query is logged and skipped, so one bad search doesn't sink the run.
    """
    results = await asyncio.gather(*(search.search(q, limit) for q in queries), return_exceptions=True)
    events: list[SearchEvent] = []
    hits: list[tuple[str, SearchHit]] = []
    for query, result in zip(queries, results, strict=True):
        if isinstance(result, BaseException):
            log.warning("Search failed for %r: %s", query, result)
            events.append(SearchEvent(query=query, status="failed"))
        else:
            hits.extend((query, hit) for hit in result)
            events.append(SearchEvent(query=query, status="done", count=len(result)))
    return events, hits


async def run_agent(
    history: list[ChatMessage], llm: LLM, search: SearchProvider, settings: Settings, web_search: bool = True
) -> AsyncIterator[AgentEvent]:
    """The whole agent loop for one request (see the module docstring for the steps).

    Event order: plan, search (started) per query, search (done/failed) per query, sources,
    token..., usage, done. Exceptions propagate; the route turns them into an error event.
    """
    if not web_search:
        async for event in stream_answer(llm, settings, chat_messages(history, DIRECT_PROMPT), "chat"):
            yield event
        return

    queries = await plan_queries(history, llm, settings.max_sub_queries)
    yield PlanEvent(queries=queries)
    if not queries:
        async for event in stream_answer(llm, settings, chat_messages(history, FOLLOW_UP_PROMPT), "follow_up"):
            yield event
        return

    for query in queries:
        yield SearchEvent(query=query, status="started")
    search_events, hits = await search_all(queries, search, settings.results_per_query)
    for event in search_events:
        yield event

    sources = build_sources(hits, settings.max_sources)
    yield SourcesEvent(sources=sources)

    block = sources_block(sources)
    messages = chat_messages(history, ANSWER_PROMPT + block)
    async for event in stream_answer(llm, settings, messages, "answer", sources_chars=len(block)):
        yield event
