# Agentic Search

A ChatGPT-style web app backed by an agent that plans several web searches, gathers sources, and answers with citations.

- `apps/web`: Next.js chat UI (streams agent events: plan → searches → sources → answer), with a model picker
- `apps/api`: FastAPI agent; works with any OpenAI-compatible LLM API or local Ollama model, and `mock` / `searxng` search

## Run locally

Requires Node 20.9+, [uv](https://docs.astral.sh/uv/), and optionally Docker and Ollama.

```bash
make install
cp apps/api/.env.example apps/api/.env   # defaults to mock providers, no keys needed
make dev                                 # api on :8000, web on :3000
```

Real search: `make searxng` and set `SEARCH_PROVIDER=searxng`.

## Models

Pick the model per chat from the menu in the composer. The list comes from [apps/api/models.yaml](apps/api/models.yaml):

- **Local:** run `ollama serve`; every model you `ollama pull` appears automatically (LM Studio and vLLM work the same way).
- **Hosted:** a provider shows up once its key is set in `apps/api/.env` (Sarvam is preconfigured: set `SARVAM_API_KEY`).
  OpenAI, Gemini, Anthropic, Groq and OpenRouter are commented-out templates in `models.yaml`: uncomment one and add its key.
- **Any other OpenAI-compatible API:** add a provider block with its `base_url` and `api_key_env`; no code changes.

`DEFAULT_MODEL` (e.g. `ollama/llama3.2:1b`) sets the starting model; otherwise `default_model` in `models.yaml` is used.

`make test` and `make lint` run the same checks as CI.

## Code map

Every module starts with a doc comment explaining its role; this is the overview.

```text
apps/api/src/agentic_search_api/
  main.py            routes: GET /health, GET /api/models, POST /api/chat (server-sent events)
  schemas.py         API contract: request body and stream events (mirrored in web lib/types.ts)
  config.py          settings from env / .env
  dependencies.py    resolves the requested model and the search provider per request
  ../models.yaml     LLM providers and models (any OpenAI-compatible API, Ollama discovery)
  telemetry.py       one SQLite row per LLM call (make usage / make metrics)
  agent/
    pipeline.py      run_agent: plan -> search -> sources -> answer -> usage
    planner.py       conversation -> search queries
    sources.py       dedupe and number hits, format them for the prompt
    prompts.py       every system prompt and the rich-block format guide
    usage.py         tokens, context window and cost for the usage event
  providers/
    llm/             LLM interface + adapters (OpenAI-compatible, mock), factory, model catalog
    search.py        SearchProvider protocol, SearXNG, mock

apps/web/src/
  app/               Next.js layout and page
  config/            theme selection, example questions, provider labels
  lib/api/           fetch + SSE client for the API
  lib/chat/          pure chat logic: event reducer, history trimming, turns, citations, usage math
  hooks/             useChat (threads, model per thread, send/stop), useModels, useApiInfo, useElapsedTime
  components/
    layout/          header, history menu, theme toggle, backdrop
    chat/            ChatApp, WelcomeScreen, Conversation, TurnOutline
      turn/          one question + answer: research trail, sources, meta, graph
      composer/      input box, model picker, web search toggle, session usage panel
      markdown/      RichMarkdown with citations, code, mermaid, tables
        blocks/      chart / comparison / timeline / stats blocks and their registry
    ui/              shadcn primitives
```

### Extending

- **Model or LLM provider:** add it to `apps/api/models.yaml` (any OpenAI-compatible API). For a different API style, write an adapter in `providers/llm/` and register its kind in `factory.py`.
- **Search provider:** implement the protocol in `providers/search.py`, add a branch in `dependencies.py`, and add the option to `config.py`.
- **Rich answer block:** add `<name>-block.tsx` in `markdown/blocks/`, register it in `registry.ts`, and describe its JSON in `prompts.py` (`FORMAT_GUIDE`).
- **Stream event:** add the model to `schemas.py`, mirror it in `lib/types.ts`, and handle it in `lib/chat/events.ts`.
- **Theme:** add a palette in `globals.css` and its name to `config/theme.ts`.
- **Accent color** (header palette menu): add `[data-accent="<name>"]` light and dark blocks in `globals.css` and an entry in `ACCENTS` (`config/theme.ts`).
