"""Token, context-window and cost accounting for a run, sent to the web app as the `usage` event."""

from agentic_search_api.config import Settings
from agentic_search_api.providers.llm import LLM, Message
from agentic_search_api.schemas import CallUsage, ContextBreakdown, UsageEvent


def context_breakdown(messages: list[Message], sources_chars: int, prompt_tokens: int) -> ContextBreakdown:
    """Splits the final call's prompt tokens across its parts in proportion to their character counts.

    `messages[0]` is the system prompt, which includes the sources block (`sources_chars` long);
    the last message is the question and everything between is history. It's an estimate, since
    providers only report the total.
    """
    conversation = messages[1:]
    parts = {
        "instructions": len(messages[0]["content"]) - sources_chars,
        "sources": sources_chars,
        "history": sum(len(m["content"]) for m in conversation[:-1]),
        "question": len(conversation[-1]["content"]) if conversation else 0,
    }
    total = sum(parts.values()) or 1
    return ContextBreakdown(**{name: round(prompt_tokens * chars / total) for name, chars in parts.items()})


def usage_event(llm: LLM, settings: Settings, messages: list[Message], sources_chars: int) -> UsageEvent:
    """Summarizes every LLM call in this run; context use is measured on the final (answer) call.

    `cost` is filled only when both prices are configured.
    """
    calls = [
        CallUsage(
            purpose=r.purpose,
            prompt_tokens=r.prompt_tokens,
            completion_tokens=r.completion_tokens,
            reasoning_tokens=r.reasoning_tokens,
            cached_tokens=r.cached_tokens,
            latency_ms=r.latency_ms,
            ttft_ms=r.ttft_ms,
        )
        for r in llm.records
    ]
    final = llm.records[-1] if llm.records else None
    context_tokens = final.prompt_tokens if final and final.prompt_tokens is not None else 0

    cost = None
    if settings.price_input_per_mtok is not None and settings.price_output_per_mtok is not None:
        prompt = sum(c.prompt_tokens or 0 for c in calls)
        completion = sum(c.completion_tokens or 0 for c in calls)
        cost = (prompt * settings.price_input_per_mtok + completion * settings.price_output_per_mtok) / 1_000_000

    return UsageEvent(
        model=llm.model,
        context_window=settings.context_window_tokens,
        context_tokens=context_tokens,
        reserved_output_tokens=llm.max_tokens,
        breakdown=context_breakdown(messages, sources_chars, context_tokens),
        calls=calls,
        cost=cost,
        currency=settings.price_currency if cost is not None else None,
    )
