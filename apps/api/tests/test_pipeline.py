from collections.abc import AsyncIterator
from typing import Any

from agentic_search_api.agent.pipeline import run_agent
from agentic_search_api.agent.planner import plan_input
from agentic_search_api.agent.sources import build_sources
from agentic_search_api.config import Settings
from agentic_search_api.providers.llm import Message
from agentic_search_api.schemas import ChatMessage, SearchHit, UsageEvent
from agentic_search_api.telemetry import LLMCallRecord

SETTINGS = Settings(_env_file=None)


class ScriptedLLM:
    model = "scripted"
    max_tokens = 4096

    def __init__(self, queries: list[str]) -> None:
        self.queries = queries
        self.plan_inputs: list[str] = []
        self.stream_purposes: list[str] = []
        self.records: list[LLMCallRecord] = []

    def _record(self, purpose: str, prompt_tokens: int, completion_tokens: int) -> None:
        record = LLMCallRecord(
            run_id="r", purpose=purpose, provider="x", model=self.model, stream=True, request_params={}, input_chars=0
        )
        record.prompt_tokens, record.completion_tokens = prompt_tokens, completion_tokens
        self.records.append(record)

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        self.plan_inputs.append(messages[-1]["content"])
        self._record(name, 100, 20)
        return {"queries": self.queries}

    async def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        self.stream_purposes.append(purpose)
        yield "ok"
        self._record(purpose, 1000, 300)


class CountingSearch:
    def __init__(self) -> None:
        self.queries: list[str] = []

    async def search(self, query: str, limit: int) -> list[SearchHit]:
        self.queries.append(query)
        return [SearchHit(title="t", url=f"https://example.com/{len(self.queries)}")]


FOLLOW_UP = [
    ChatMessage(role="user", content="Compare PostgreSQL, MySQL and MongoDB"),
    ChatMessage(role="assistant", content="PostgreSQL is ... MySQL is ... MongoDB is ..."),
    ChatMessage(role="user", content="summarize that in tables"),
]


async def test_reformat_follow_up_skips_search() -> None:
    llm, search = ScriptedLLM(queries=[]), CountingSearch()

    types = [e.type async for e in run_agent(FOLLOW_UP, llm, search, SETTINGS)]

    assert types == ["plan", "token", "usage", "done"]
    assert search.queries == []
    assert llm.stream_purposes == ["follow_up"]


async def test_planner_sees_conversation_context() -> None:
    llm, search = ScriptedLLM(queries=["postgresql vs mysql vs mongodb"]), CountingSearch()

    types = [e.type async for e in run_agent(FOLLOW_UP, llm, search, SETTINGS)]

    assert "PostgreSQL, MySQL and MongoDB" in llm.plan_inputs[0]
    assert search.queries == ["postgresql vs mysql vs mongodb"]
    assert types[-1] == "done" and llm.stream_purposes == ["answer"]


async def test_first_question_always_searches_even_if_planner_returns_nothing() -> None:
    llm, search = ScriptedLLM(queries=[]), CountingSearch()

    [e async for e in run_agent(FOLLOW_UP[:1], llm, search, SETTINGS)]

    assert search.queries == [FOLLOW_UP[0].content]


def test_plan_input_truncates_long_earlier_messages() -> None:
    history = [ChatMessage(role="assistant", content="a" * 5000), ChatMessage(role="user", content="next")]
    text = plan_input(history)
    assert "a" * 800 in text and "a" * 801 not in text and text.endswith("next")


def test_build_sources_dedupes_and_keeps_every_query_per_source() -> None:
    hit = lambda url: SearchHit(title=url, url=url)  # noqa: E731
    hits = [("q1", hit("https://a")), ("q2", hit("https://a")), ("q2", hit("https://b")), ("q3", hit("https://c"))]

    sources = build_sources(hits, limit=2)

    assert [(s.id, s.url, s.queries) for s in sources] == [(1, "https://a", ["q1", "q2"]), (2, "https://b", ["q2"])]


async def test_usage_event_reports_context_breakdown_and_cost() -> None:
    settings = Settings(_env_file=None, price_input_per_mtok=100, price_output_per_mtok=400, price_currency="INR")
    llm, search = ScriptedLLM(queries=["db comparison"]), CountingSearch()

    events = [e async for e in run_agent(FOLLOW_UP, llm, search, settings)]
    usage = next(e for e in events if isinstance(e, UsageEvent))

    assert [e.type for e in events][-2:] == ["usage", "done"]
    assert usage.context_tokens == 1000 and usage.context_window == 128_000 and usage.reserved_output_tokens == 4096
    assert [c.purpose for c in usage.calls] == ["search_plan", "answer"]
    parts = usage.breakdown
    assert parts.instructions > 0 and parts.sources > 0 and parts.history > 0 and parts.question > 0
    assert abs(parts.instructions + parts.sources + parts.history + parts.question - 1000) <= 2
    assert usage.cost == (1100 * 100 + 320 * 400) / 1_000_000 and usage.currency == "INR"


async def test_usage_event_has_no_cost_without_pricing() -> None:
    events = [e async for e in run_agent(FOLLOW_UP, ScriptedLLM([]), CountingSearch(), SETTINGS, web_search=False)]
    usage = next(e for e in events if isinstance(e, UsageEvent))
    assert usage.cost is None and usage.breakdown.sources == 0 and [c.purpose for c in usage.calls] == ["chat"]
