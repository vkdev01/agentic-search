"""Step 1 of a run: turn the conversation into web search queries."""

import logging

from agentic_search_api.agent.prompts import PLAN_PROMPT, PLAN_SCHEMA
from agentic_search_api.providers.llm import LLM, Message
from agentic_search_api.schemas import ChatMessage

log = logging.getLogger(__name__)

PLAN_CONTEXT_MESSAGES = 6
"""How many earlier messages the planner sees, so follow-ups like "compare them" resolve."""
PLAN_CONTEXT_CHARS = 800
"""Each earlier message is cut to this many characters to keep planning cheap."""


def plan_input(history: list[ChatMessage]) -> str:
    """Formats recent conversation plus the latest message as the planner's single user message."""
    earlier = history[:-1][-PLAN_CONTEXT_MESSAGES:]
    lines = [f"{m.role}: {m.content[:PLAN_CONTEXT_CHARS]}" for m in earlier]
    context = "\n".join(lines) if lines else "(none)"
    return f"Conversation so far:\n{context}\n\nLatest user message:\n{history[-1].content}"


async def plan_queries(history: list[ChatMessage], llm: LLM, max_queries: int) -> list[str]:
    """Asks the LLM which searches the latest message needs.

    Returns up to `max_queries` unique queries. An empty list means "no new search needed" (only allowed
    for follow-ups; a first question always searches). If planning fails, falls back to the raw question.
    """
    question = history[-1].content
    messages: list[Message] = [
        {"role": "system", "content": PLAN_PROMPT.format(n=max_queries)},
        {"role": "user", "content": plan_input(history)},
    ]
    try:
        result = await llm.complete_json(messages, PLAN_SCHEMA, name="search_plan")
    except Exception:
        log.exception("Planning failed; falling back to the raw question")
        return [question]
    queries = [q.strip() for q in result.get("queries", []) if isinstance(q, str) and q.strip()]
    if not queries and len(history) == 1:
        return [question]
    return list(dict.fromkeys(queries))[:max_queries]
