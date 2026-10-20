.PHONY: install dev api web searxng searxng-stop test lint usage metrics

USAGE_DB ?= apps/api/data/llm_usage.db

install:
	cd apps/api && uv sync
	cd apps/web && npm install

dev:
	$(MAKE) -j2 api web

api:
	cd apps/api && uv run fastapi dev src/agentic_search_api/main.py --port 8000

web:
	cd apps/web && npm run dev

searxng:
	@docker start agentic-search-searxng >/dev/null 2>&1 || docker run -d --name agentic-search-searxng \
		-p 127.0.0.1:8080:8080 \
		-v "$(CURDIR)/infra/searxng/settings.yml:/etc/searxng/settings.yml:ro" \
		--restart unless-stopped docker.io/searxng/searxng:latest
	@echo "SearXNG on http://127.0.0.1:8080"

searxng-stop:
	docker stop agentic-search-searxng

# Read-only browser UI for the LLM usage DB at http://127.0.0.1:8001
metrics:
	uvx datasette serve $(USAGE_DB) --port 8001

test:
	cd apps/api && uv run pytest -q

lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check .
	cd apps/web && npm run lint && npx tsc --noEmit

usage:
	@sqlite3 -header -column $(USAGE_DB) "SELECT created_at, purpose, model, status, finish_reason, prompt_tokens AS p_tok, completion_tokens AS c_tok, reasoning_tokens AS r_tok, latency_ms, ttft_ms FROM llm_calls ORDER BY id DESC LIMIT 20;"
	@echo
	@sqlite3 -header -column $(USAGE_DB) "SELECT purpose, model, COUNT(*) AS calls, SUM(prompt_tokens) AS prompt, SUM(completion_tokens) AS completion, SUM(reasoning_tokens) AS reasoning, ROUND(AVG(latency_ms)) AS avg_ms, ROUND(AVG(ttft_ms)) AS avg_ttft_ms FROM llm_calls WHERE status = 'ok' GROUP BY purpose, model;"
