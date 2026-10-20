from typing import Annotated, Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: Annotated[str, Field(min_length=1, max_length=4000)]


class ChatRequest(BaseModel):
    messages: Annotated[list[ChatMessage], Field(min_length=1, max_length=20)]


class SearchHit(BaseModel):
    title: str
    url: str
    snippet: str = ""


class Source(SearchHit):
    id: int


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


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


AgentEvent = PlanEvent | SearchEvent | SourcesEvent | TokenEvent | DoneEvent | ErrorEvent
