"""Per-call LLM telemetry (tokens, latency, errors) stored in SQLite.

One row per LLM call in `llm_calls`; rows from the same request share a `run_id`.
Browse it with `make usage` or `make metrics` (Datasette).
"""

import json
import logging
import sqlite3
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from functools import lru_cache
from pathlib import Path
from typing import Any

from openai.types import CompletionUsage

from agentic_search_api.config import get_settings

log = logging.getLogger(__name__)

SCHEMA = """
CREATE TABLE IF NOT EXISTS llm_calls (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at        TEXT NOT NULL,
    run_id            TEXT NOT NULL,
    purpose           TEXT NOT NULL,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    stream            INTEGER NOT NULL,
    status            TEXT NOT NULL,
    error             TEXT,
    finish_reason     TEXT,
    response_id       TEXT,
    prompt_tokens     INTEGER,
    completion_tokens INTEGER,
    reasoning_tokens  INTEGER,
    cached_tokens     INTEGER,
    total_tokens      INTEGER,
    latency_ms        REAL,
    ttft_ms           REAL,
    first_reasoning_ms REAL,
    input_chars       INTEGER,
    output_chars      INTEGER,
    reasoning_chars   INTEGER,
    request_params    TEXT,
    response_meta     TEXT
);
CREATE INDEX IF NOT EXISTS idx_llm_calls_run ON llm_calls(run_id);
CREATE INDEX IF NOT EXISTS idx_llm_calls_created ON llm_calls(created_at);
"""


@dataclass
class LLMCallRecord:
    """Everything measured about one LLM call; field names match the `llm_calls` columns.

    Times are milliseconds from the request start: `ttft_ms` to the first answer token,
    `first_reasoning_ms` to the first reasoning token. Token counts are None when the provider omits them.
    """

    run_id: str
    purpose: str
    provider: str
    model: str
    stream: bool
    request_params: dict[str, Any]
    input_chars: int
    created_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    status: str = "ok"
    error: str | None = None
    finish_reason: str | None = None
    response_id: str | None = None
    prompt_tokens: int | None = None
    completion_tokens: int | None = None
    reasoning_tokens: int | None = None
    cached_tokens: int | None = None
    total_tokens: int | None = None
    latency_ms: float | None = None
    ttft_ms: float | None = None
    first_reasoning_ms: float | None = None
    output_chars: int = 0
    reasoning_chars: int = 0
    response_meta: dict[str, Any] = field(default_factory=dict)

    def set_usage(self, usage: CompletionUsage) -> None:
        """Copies token counts from the provider's usage block, keeping the raw block in `response_meta`."""
        self.prompt_tokens = usage.prompt_tokens
        self.completion_tokens = usage.completion_tokens
        self.total_tokens = usage.total_tokens
        if usage.completion_tokens_details:
            self.reasoning_tokens = usage.completion_tokens_details.reasoning_tokens
        if usage.prompt_tokens_details:
            self.cached_tokens = usage.prompt_tokens_details.cached_tokens
        self.response_meta["usage"] = usage.model_dump(exclude_none=True)


class UsageStore:
    """Appends one row per LLM call to a local SQLite file."""

    def __init__(self, path: Path) -> None:
        self.path = path
        path.parent.mkdir(parents=True, exist_ok=True)
        with sqlite3.connect(path) as conn:
            conn.executescript(SCHEMA)

    def insert(self, record: LLMCallRecord) -> None:
        """Saves one record. Failures are logged, never raised, so telemetry can't break a chat."""
        row = asdict(record)
        row["stream"] = int(record.stream)
        row["request_params"] = json.dumps(record.request_params, default=str)
        row["response_meta"] = json.dumps(record.response_meta, default=str)
        columns = ", ".join(row)
        placeholders = ", ".join(f":{name}" for name in row)
        try:
            with sqlite3.connect(self.path) as conn:
                conn.execute(f"INSERT INTO llm_calls ({columns}) VALUES ({placeholders})", row)
        except sqlite3.Error:
            log.exception("Failed to record LLM call")


@lru_cache
def get_usage_store() -> UsageStore:
    """The process-wide store at LLM_USAGE_DB (creates the file and table on first use)."""
    return UsageStore(get_settings().llm_usage_db)
