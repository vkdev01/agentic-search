"""The API contract: the chat request body and the events streamed back.

The web app mirrors these in apps/web/src/lib/types.ts, so change both together.
"""

from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

MAX_QUESTION_CHARS = 4000


# --- Request ---


class ChatMessage(BaseModel):
    """One message of the conversation the client sends with each request."""

    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=32_000)]


class ChatRequest(BaseModel):
    """The whole conversation (the server keeps no chat state); the last message is the question."""

    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=40)]
    web_search: bool = True
    model: Annotated[str | None, Field(max_length=200)] = None
    """A model id from GET /api/models; None uses the default model."""

    @model_validator(mode="after")
    def check_question(self) -> Self:
        question = self.messages[-1]
        if question.role != "user":
            raise ValueError("The last message must be from the user")
        if len(question.content) > MAX_QUESTION_CHARS:
            raise ValueError(f"Question is too long (max {MAX_QUESTION_CHARS} characters)")
        return self


# --- Models ---


class ModelInfo(BaseModel):
    """A selectable model as shown in the UI (no URLs or keys)."""

    id: str
    label: str
    provider: str
    provider_label: str
    local: bool = False
    reasoning: bool = False
    context_window: int | None = None


class ModelList(BaseModel):
    """GET /api/models: what the model picker offers."""

    default_model: str | None
    models: list[ModelInfo]


# --- Search ---


class SearchHit(BaseModel):
    """One result from a search provider."""

    title: str
    url: str
    snippet: str = ""


class Source(SearchHit):
    """A deduplicated hit given to the model; `id` is the n in its [n] citations."""

    id: int
    queries: list[str] = []
    """Every planned query that returned this URL."""


# --- Stream events (in the order a run sends them) ---


class PlanEvent(BaseModel):
    """The planned queries; empty means a follow-up answered without searching."""

    type: Literal["plan"] = "plan"
    queries: list[str]


class SearchEvent(BaseModel):
    """Progress of one query: sent as `started`, then `done` (with hit count) or `failed`."""

    type: Literal["search"] = "search"
    query: str
    status: Literal["started", "done", "failed"]
    count: int = 0


class SourcesEvent(BaseModel):
    """The numbered sources the answer will cite."""

    type: Literal["sources"] = "sources"
    sources: list[Source]


class TokenEvent(BaseModel):
    """A chunk of answer markdown; append in order."""

    type: Literal["token"] = "token"
    text: str


class DoneEvent(BaseModel):
    """The run finished successfully."""

    type: Literal["done"] = "done"


class CallUsage(BaseModel):
    """Token counts and timings of one LLM call (None when the provider didn't report it)."""

    purpose: str
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_tokens: int | None = None
    cached_tokens: int | None = None
    latency_ms: float | None = None
    ttft_ms: float | None = None


class ContextBreakdown(BaseModel):
    """Approximate split of the final call's prompt tokens, proportional to characters."""

    instructions: int = 0
    sources: int = 0
    history: int = 0
    question: int = 0


class UsageEvent(BaseModel):
    """Sent after the answer: every LLM call in the run, plus how full the context window was."""

    type: Literal["usage"] = "usage"
    model: str
    context_window: int
    context_tokens: int
    """Prompt tokens of the final (answer) call."""
    reserved_output_tokens: int | None = None
    breakdown: ContextBreakdown
    calls: list[CallUsage]
    cost: float | None = None
    currency: str | None = None


class ErrorEvent(BaseModel):
    """The run failed; `message` is safe to show to the user."""

    type: Literal["error"] = "error"
    message: str


AgentEvent = PlanEvent | SearchEvent | SourcesEvent | TokenEvent | UsageEvent | DoneEvent | ErrorEvent
