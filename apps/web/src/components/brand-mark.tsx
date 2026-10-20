import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-8 rounded-lg [&_svg]:size-4",
  md: "size-9 rounded-xl [&_svg]:size-4.5",
  lg: "size-14 rounded-2xl [&_svg]:size-7",
} as const;

/** App identity tile: brand-colored square with the sparkles icon. */
export function BrandMark({ size = "sm", className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center bg-linear-to-br from-primary to-primary/75 text-primary-foreground shadow-sm",
        SIZES[size],
        className,
      )}
    >
      <Sparkles />
    </span>
  );
}
