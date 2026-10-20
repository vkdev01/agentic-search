import { cn } from "@/lib/utils";
import { BrandIcon } from "./brand-icon";

const SIZES = {
  sm: "size-6 rounded-md [&_svg]:size-3.5",
  md: "size-8 rounded-lg [&_svg]:size-4.5",
  lg: "size-12 rounded-xl [&_svg]:size-6",
} as const;

/**
 * App logo: the brand icon on a gradient tile in the theme's chart colors, so it follows the active palette.
 * While `working`, a light sheen sweeps around the tile.
 */
export function BrandMark({
  size = "sm",
  working = false,
  className,
}: {
  size?: keyof typeof SIZES;
  working?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative inline-grid shrink-0 place-items-center overflow-hidden bg-linear-to-br from-chart-1 to-chart-2 text-white shadow-sm",
        SIZES[size],
        className,
      )}
    >
      {working && (
        <span className="absolute -inset-1/2 animate-spin bg-[conic-gradient(transparent_0deg,white_70deg,transparent_140deg)] opacity-40 [animation-duration:1.6s]" />
      )}
      <BrandIcon className="relative" strokeWidth={2.25} />
    </span>
  );
}
