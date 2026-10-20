import { cn } from "@/lib/utils";

/** Round, borderless icon button used in the header toolbar. Always pass an `aria-label`. */
export function IconButton({ className, ...props }: React.ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "grid size-8 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40 [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}
