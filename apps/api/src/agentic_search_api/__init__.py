def main() -> None:
    import uvicorn

    uvicorn.run("agentic_search_api.main:app", host="127.0.0.1", port=8000, reload=True)
