/** Bordered card with an optional caption; the common frame for UI blocks. */
export function BlockFrame({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <figure className="not-prose my-4 rounded-xl border bg-card p-4">
      {title && <figcaption className="mb-3 text-sm font-medium">{title}</figcaption>}
      {children}
    </figure>
  );
}
