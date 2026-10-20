from typing import Annotated, Literal, Self

from pydantic import BaseModel, Field, model_validator

MAX_QUESTION_CHARS = 4000


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=32_000)]


class ChatRequest(BaseModel):
    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=40)]
    web_search: bool = True

    @model_validator(mode="after")
    def check_question(self) -> Self:
        question = self.messages[-1]
        if question.role != "user":
            raise ValueError("The last message must be from the user")
        if len(question.content) > MAX_QUESTION_CHARS:
            raise ValueError(f"Question is too long (max {MAX_QUESTION_CHARS} characters)")
        return self


class SearchHit(BaseModel):
    title: str
    url: str
    snippet: str = ""


class Source(SearchHit):
    id: int
    queries: list[str] = []


class PlanEvent(BaseModel):
    type: Literal["plan"] = "plan"
    queries: list[str]


class SearchEvent(BaseModel):
    type: Literal["search"] = "search"
    query: str
    status: Literal["started", "done", "failed"]
    count: int = 0


class SourcesEvent(BaseModel):
    type: Literal["sources"] = "sources"
    sources: list[Source]


class TokenEvent(BaseModel):
    type: Literal["token"] = "token"
    text: str


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"


class CallUsage(BaseModel):
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
    type: Literal["usage"] = "usage"
    model: str
    context_window: int
    context_tokens: int
    reserved_output_tokens: int | None = None
    breakdown: ContextBreakdown
    calls: list[CallUsage]
    cost: float | None = None
    currency: str | None = None


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


AgentEvent = PlanEvent | SearchEvent | SourcesEvent | TokenEvent | UsageEvent | DoneEvent | ErrorEvent
