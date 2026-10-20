"use client";

import { useEffect, useState } from "react";

/** Milliseconds since `since` (epoch ms), re-rendering every 250 ms while mounted; 0 when `since` is unset. */
export function useElapsedTime(since: number | undefined): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);
  return since ? Math.max(0, now - since) : 0;
}
