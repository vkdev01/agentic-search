"""Chat model providers, behind one interface (base.LLM) with an adapter per API style.

base.py               LLM protocol + ModelSpec
openai_compatible.py  adapter for every OpenAI-compatible API (hosted and local)
mock.py               offline adapter
factory.py            adapter kind -> class
catalog.py            models.yaml + live discovery -> available models
"""

from agentic_search_api.providers.llm.base import LLM, Message, ModelSpec
from agentic_search_api.providers.llm.catalog import ModelCatalog, UnknownModelError, load_catalog_file
from agentic_search_api.providers.llm.factory import create_llm

__all__ = ["LLM", "Message", "ModelCatalog", "ModelSpec", "UnknownModelError", "create_llm", "load_catalog_file"]
