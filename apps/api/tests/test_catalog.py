from collections.abc import Callable, Iterator
from pathlib import Path

import httpx
import pytest

from agentic_search_api.config import Settings
from agentic_search_api.providers.llm import ModelCatalog, UnknownModelError, create_llm, load_catalog_file
from agentic_search_api.providers.llm import catalog as catalog_module
from agentic_search_api.providers.llm.base import ModelSpec
from agentic_search_api.providers.llm.openai_compatible import OpenAICompatibleLLM

CATALOG = """
default_model: hosted/big
providers:
  hosted:
    label: Hosted
    base_url: https://llm.example/v1
    api_key_env: HOSTED_KEY
    api_key_headers: [x-api-key]
    models:
      - { id: big, label: Big, context_window: 100000, price_input_per_mtok: 1, price_output_per_mtok: 2 }
  local:
    label: Local
    base_url: http://local.test/v1
    local: true
    discover: true
    include: ["qwen*", "llama*"]
    context_window: 8192
"""


@pytest.fixture(autouse=True)
def fresh_discovery() -> Iterator[None]:
    catalog_module._discovered.clear()
    yield
    catalog_module._discovered.clear()


def make_catalog(tmp_path: Path, **settings: object) -> ModelCatalog:
    path = tmp_path / "models.yaml"
    path.write_text(CATALOG)
    return ModelCatalog(load_catalog_file(path), Settings(_env_file=None, **settings))


def http(respond: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(respond))


def local_models(request: httpx.Request) -> httpx.Response:
    assert request.url == "http://local.test/v1/models"
    return httpx.Response(200, json={"data": [{"id": "qwen3:8b"}, {"id": "llama3.2"}, {"id": "nomic-embed-text"}]})


def unreachable(request: httpx.Request) -> httpx.Response:
    raise httpx.ConnectError("down", request=request)


async def test_provider_is_hidden_until_its_key_is_set(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    catalog = make_catalog(tmp_path)
    async with http(unreachable) as client:
        assert [m.id for m in await catalog.models(client)] == ["mock"]

        monkeypatch.setenv("HOSTED_KEY", "secret")
        [hosted, mock] = await catalog.models(client)

    assert (hosted.id, hosted.model, hosted.provider_label) == ("hosted/big", "big", "Hosted")
    assert hosted.context_window == 100000
    assert hosted.api_key and hosted.api_key.get_secret_value() == "secret"
    assert hosted.price_per_mtok == (1, 2) and mock.id == "mock"


async def test_discovery_lists_installed_models_matching_include(tmp_path: Path) -> None:
    catalog = make_catalog(tmp_path, mock_model=False)
    async with http(local_models) as client:
        models = await catalog.models(client)

    assert [m.id for m in models] == ["local/llama3.2", "local/qwen3:8b"]
    assert all(m.local and m.context_window == 8192 and m.price_per_mtok == (0, 0) for m in models)


async def test_unreachable_local_server_just_lists_no_models(tmp_path: Path) -> None:
    async with http(unreachable) as client:
        assert await make_catalog(tmp_path, mock_model=False).models(client) == []


async def test_default_falls_back_when_configured_default_is_unavailable(tmp_path: Path) -> None:
    async with http(local_models) as client:
        # hosted/big (the file default) has no key, so the first available model is used.
        assert await make_catalog(tmp_path).default_id(client) == "local/llama3.2"
        assert await make_catalog(tmp_path, default_model="local/qwen3:8b").default_id(client) == "local/qwen3:8b"


async def test_resolve_returns_spec_or_raises(tmp_path: Path) -> None:
    catalog = make_catalog(tmp_path)
    async with http(local_models) as client:
        assert (await catalog.resolve("local/qwen3:8b", client)).model == "qwen3:8b"
        assert (await catalog.resolve(None, client)).id == "local/llama3.2"
        with pytest.raises(UnknownModelError):
            await catalog.resolve("local/not-pulled", client)


def test_factory_builds_openai_adapter_with_key_headers() -> None:
    spec = ModelSpec(
        id="hosted/big",
        provider="hosted",
        provider_label="Hosted",
        kind="openai",
        model="big",
        label="Big",
        base_url="https://llm.example/v1",
        api_key="secret",  # type: ignore[arg-type]
        api_key_headers=["x-api-key"],
        context_window=100000,
    )
    llm = create_llm(spec, "run-1", None)

    assert isinstance(llm, OpenAICompatibleLLM)
    assert llm.model == "big" and llm.context_window == 100000 and llm.max_tokens is None
    assert llm._client.default_headers["x-api-key"] == "secret"


def test_factory_rejects_unknown_kind() -> None:
    spec = ModelSpec(id="x/y", provider="x", provider_label="X", kind="nope", model="y", label="Y")
    with pytest.raises(ValueError, match="unknown adapter kind"):
        create_llm(spec, "run-1", None)
