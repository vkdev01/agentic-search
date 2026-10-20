"use client";

import { useEffect, useState } from "react";
import { fetchApiInfo } from "@/lib/api/client";
import type { ApiInfo } from "@/lib/types";

/** The API's provider info from GET /health, fetched once on mount; null while loading or if the API is down. */
export function useApiInfo(): ApiInfo | null {
  const [info, setInfo] = useState<ApiInfo | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchApiInfo(controller.signal)
      .then(setInfo)
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return info;
}
