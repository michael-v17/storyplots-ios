import type { LucideIcon, LucideProps } from "lucide-react";

// Thin wrapper around lucide-react that fixes the DesignSystem's default
// stroke weight (1.75 per DesignSystem/README §Iconography) and inherits
// color from the parent via `currentColor`. Consumers pass the actual
// Lucide component directly, e.g. `<Icon icon={Home} size={18} />`.
type Props = {
  icon: LucideIcon;
  size?: number;
  strokeWidth?: number;
} & Omit<LucideProps, "ref">;

export function Icon({ icon: LucideComp, size = 18, strokeWidth = 1.75, ...rest }: Props) {
  return <LucideComp size={size} strokeWidth={strokeWidth} aria-hidden {...rest} />;
}
