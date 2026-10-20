from functools import lru_cache
from typing import Literal

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    llm_provider: Literal["mock", "sarvam", "ollama"] = "mock"
    sarvam_api_key: SecretStr | None = None
    sarvam_base_url: str = "https://api.sarvam.ai/v1"
    sarvam_model: str = "sarvam-105b"
    ollama_base_url: str = "http://localhost:11434/v1"
    ollama_model: str = ""

    search_provider: Literal["mock", "searxng"] = "mock"
    searxng_url: str = "http://localhost:8080"

    max_sub_queries: int = 4
    results_per_query: int = 5
    max_sources: int = 10

    cors_origins: list[str] = ["http://localhost:3000"]


@lru_cache
def get_settings() -> Settings:
    return Settings()
