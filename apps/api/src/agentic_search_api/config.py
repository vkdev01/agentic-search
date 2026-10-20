"""All runtime settings, read from environment variables or apps/api/.env (see .env.example)."""

import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Field names map to upper-case env vars, e.g. `default_model` <- DEFAULT_MODEL. Empty values are ignored.

    Unknown .env keys are kept (extra="allow") so models.yaml can name API keys stored there; see env_value.
    """

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="allow", env_ignore_empty=True)

    # Chat models: providers and models live in models.yaml; keys stay in the environment / .env.
    models_file: Path = Path("models.yaml")
    default_model: str | None = None
    """Model id used when a request doesn't pick one, e.g. `sarvam/sarvam-105b` or `ollama/qwen3:8b`."""
    mock_model: bool = True
    """List the offline mock model (handy for development; turn off when deployed)."""

    search_provider: Literal["mock", "searxng"] = "mock"
    searxng_url: str = "http://localhost:8080"

    # Research breadth per question: queries planned, hits kept per query, sources given to the model.
    max_sub_queries: int = 4
    results_per_query: int = 5
    max_sources: int = 10

    llm_usage_db: Path = Path("data/llm_usage.db")
    # Fallbacks for models that don't set their own context_window / prices in models.yaml.
    context_window_tokens: int = 128_000
    # Optional pricing per 1M tokens; when unset the UI shows tokens only.
    price_input_per_mtok: float | None = None
    price_output_per_mtok: float | None = None
    price_currency: str = "INR"

    cors_origins: list[str] = ["http://localhost:3000"]

    def env_value(self, name: str) -> str | None:
        """A variable from the process environment, else from .env (e.g. an API key named in models.yaml)."""
        return os.environ.get(name) or (self.model_extra or {}).get(name.lower()) or None


@lru_cache
def get_settings() -> Settings:
    """Settings are read once per process; tests override this dependency instead."""
    return Settings()
