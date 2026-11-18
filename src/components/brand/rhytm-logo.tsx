import { cn } from "@/lib/utils";

const CIEMNY = "#171717";
const AKCENT = "#15803d";

// Siatka 3×3 kwadratów 11×11 (rx=3), pozycje 4/18/32; krycia wierszami
const KWADRATY: { x: number; y: number; opacity: number; accent?: boolean }[] =
  [
    { x: 4, y: 4, opacity: 1 },
    { x: 18, y: 4, opacity: 0.55 },
    { x: 32, y: 4, opacity: 0.25 },
    { x: 4, y: 18, opacity: 0.55 },
    { x: 18, y: 18, opacity: 0.25 },
    { x: 32, y: 18, opacity: 1, accent: true },
    { x: 4, y: 32, opacity: 0.25 },
    { x: 18, y: 32, opacity: 1 },
    { x: 32, y: 32, opacity: 0.55 },
  ];

export function RhytmLogo({
  size = 24,
  withWordmark = false,
  className,
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 48 48"
        role="img"
        aria-label="rhytm"
        className="flex-none"
      >
        {KWADRATY.map((k) => (
          <rect
            key={`${k.x}-${k.y}`}
            x={k.x}
            y={k.y}
            width={11}
            height={11}
            rx={3}
            fill={k.accent ? AKCENT : CIEMNY}
            opacity={k.opacity}
          />
        ))}
      </svg>
      {withWordmark && (
        <span className="text-[17px] font-semibold tracking-[-0.045em] text-foreground">
          rhytm
        </span>
      )}
    </div>
  );
}
