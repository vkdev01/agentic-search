/** Fixed background: faint color glow at the page edges, kept away from the reading column. */
export function CanvasBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="aurora-blob absolute -top-64 -right-64 size-[34rem] rounded-full bg-chart-1/8 blur-3xl dark:bg-chart-1/6" />
      <div className="aurora-blob absolute -bottom-64 -left-64 size-[34rem] rounded-full bg-chart-2/8 blur-3xl [animation-delay:-13s] dark:bg-chart-2/5" />
    </div>
  );
}
