"""All runtime settings, read from environment variables or apps/api/.env (see .env.example)."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Field names map to upper-case env vars, e.g. `llm_provider` <- LLM_PROVIDER. Empty values are ignored."""

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore", env_ignore_empty=True)

    llm_provider: Literal["mock", "sarvam", "ollama"] = "mock"
    sarvam_api_key: SecretStr | None = None
    sarvam_base_url: str = "https://api.sarvam.ai/v1"
    sarvam_model: str = "sarvam-105b"
    # Reasoning tokens count against max_tokens, so leave room for thinking + answer.
    sarvam_max_tokens: int = 16384
    sarvam_reasoning_effort: Literal["low", "medium", "high", "max"] = "low"
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = ""

    search_provider: Literal["mock", "searxng"] = "mock"
    searxng_url: str = "http://localhost:8080"

    # Research breadth per question: queries planned, hits kept per query, sources given to the model.
    max_sub_queries: int = 4
    results_per_query: int = 5
    max_sources: int = 10

    llm_usage_db: Path = Path("data/llm_usage.db")
    context_window_tokens: int = 128_000
    # Optional pricing per 1M tokens; when unset the UI shows tokens only.
    price_input_per_mtok: float | None = None
    price_output_per_mtok: float | None = None
    price_currency: str = "INR"

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    """Settings are read once per process; tests override this dependency instead."""
    return Settings()
