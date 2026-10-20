.PHONY: install dev api web searxng test lint

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
	docker compose up -d searxng

test:
	cd apps/api && uv run pytest -q

lint:
	cd apps/api && uv run ruff check . && uv run ruff format --check .
	cd apps/web && npm run lint && npx tsc --noEmit
