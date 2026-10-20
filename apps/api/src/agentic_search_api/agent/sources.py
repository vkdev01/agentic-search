"""Step 2 of a run: merge search hits into numbered sources and format them for the answer prompt."""

from agentic_search_api.schemas import SearchHit, Source


def build_sources(hits: list[tuple[str, SearchHit]], limit: int) -> list[Source]:
    """Dedupes `(query, hit)` pairs by URL and numbers the first `limit` sources from 1.

    A URL found by several queries becomes one source that lists all of them in `queries`
    (the web app's research graph draws those links). Order follows `hits`.
    """
    by_url: dict[str, Source] = {}
    for query, hit in hits:
        if hit.url in by_url:
            if query not in by_url[hit.url].queries:
                by_url[hit.url].queries.append(query)
        elif len(by_url) < limit:
            by_url[hit.url] = Source(id=len(by_url) + 1, queries=[query], **hit.model_dump())
    return list(by_url.values())


def sources_block(sources: list[Source]) -> str:
    """Renders sources as `<source id=..>` tags; the ids are what the model cites as [n]."""
    context = "\n\n".join(f'<source id="{s.id}" url="{s.url}">\n{s.title}\n{s.snippet}\n</source>' for s in sources)
    return f"\n\n<sources>\n{context}\n</sources>"
