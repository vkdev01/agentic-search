from collections.abc import AsyncIterator
from typing import Any

from agentic_search_api.agent.pipeline import plan_input, run_agent
from agentic_search_api.config import Settings
from agentic_search_api.providers.llm import Message
from agentic_search_api.schemas import ChatMessage, SearchHit

SETTINGS = Settings(_env_file=None)


class ScriptedLLM:
    def __init__(self, queries: list[str]) -> None:
        self.queries = queries
        self.plan_inputs: list[str] = []
        self.stream_purposes: list[str] = []

    async def complete_json(self, messages: list[Message], schema: dict[str, Any], name: str) -> dict[str, Any]:
        self.plan_inputs.append(messages[-1]["content"])
        return {"queries": self.queries}

    async def stream(self, messages: list[Message], purpose: str = "answer") -> AsyncIterator[str]:
        self.stream_purposes.append(purpose)
        yield "ok"


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

    assert types == ["plan", "token", "done"]
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
