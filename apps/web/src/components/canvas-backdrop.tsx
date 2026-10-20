"use client";

import { useEffect, useRef } from "react";

/** Fixed background: soft color glow, a dot grid, and brighter dots that follow the pointer. */
export function CanvasBackdrop() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        el.style.setProperty("--mx", `${e.clientX}px`);
        el.style.setProperty("--my", `${e.clientY}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={ref} aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob absolute -top-1/3 left-1/4 size-[40rem] rounded-full bg-chart-1/12 blur-3xl dark:bg-chart-1/10" />
      <div className="aurora-blob absolute top-1/3 -right-48 size-[32rem] rounded-full bg-chart-2/12 blur-3xl [animation-delay:-9s] dark:bg-chart-2/8" />
      <div className="aurora-blob absolute -bottom-48 -left-40 size-[30rem] rounded-full bg-chart-3/12 blur-3xl [animation-delay:-17s] dark:bg-chart-3/8" />
      <div className="canvas-dots absolute inset-0" />
      <div className="canvas-spotlight absolute inset-0" />
    </div>
  );
}
