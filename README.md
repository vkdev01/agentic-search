# Agentic Search

A ChatGPT-style web app backed by an agent that plans several web searches, gathers sources, and answers with citations.

- `apps/web`: Next.js chat UI (streams agent events: plan → searches → sources → answer)
- `apps/api`: FastAPI agent, with pluggable LLM providers (`mock`, `sarvam`, `ollama`) and search providers (`mock`, `searxng`)

## Run locally

Requires Node 20.9+, [uv](https://docs.astral.sh/uv/), and optionally Docker and Ollama.

```bash
make install
cp apps/api/.env.example apps/api/.env   # defaults to mock providers, no keys needed
make dev                                 # api on :8000, web on :3000
```

Real search: `make searxng` and set `SEARCH_PROVIDER=searxng`.
Real model: set `LLM_PROVIDER=sarvam` plus `SARVAM_API_KEY`, or `LLM_PROVIDER=ollama` plus `OLLAMA_MODEL`.

`make test` and `make lint` run the same checks as CI.
