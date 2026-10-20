import { cn } from "@/lib/utils";

const SIZES = {
  sm: "size-5",
  md: "size-7",
  lg: "size-12",
} as const;

/** App logo: a ring in the theme's chart colors, so it follows the active palette; spins while the agent works. */
export function BrandMark({
  size = "sm",
  spinning = false,
  className,
}: {
  size?: keyof typeof SIZES;
  spinning?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-block shrink-0 rounded-full bg-[conic-gradient(from_140deg,var(--chart-1),var(--chart-2),var(--chart-3),var(--chart-4),var(--chart-1))]",
        spinning && "animate-spin [animation-duration:2.5s]",
        SIZES[size],
        className,
      )}
    >
      <span className="absolute inset-[24%] rounded-full bg-background" />
    </span>
  );
}
