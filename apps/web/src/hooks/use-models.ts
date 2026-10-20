"use client";

import { useEffect, useState } from "react";
import { fetchModels } from "@/lib/api/client";
import type { ModelList } from "@/lib/types";

const EMPTY: ModelList = { default_model: null, models: [] };

/** The selectable models from GET /api/models, fetched once on mount; empty while loading or if the API is down. */
export function useModels(): ModelList {
  const [list, setList] = useState<ModelList>(EMPTY);
  useEffect(() => {
    const controller = new AbortController();
    fetchModels(controller.signal)
      .then(setList)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return list;
}
