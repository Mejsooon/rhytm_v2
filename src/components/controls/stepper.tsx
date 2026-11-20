import { cn } from "@/lib/utils";

const PRZYCISK =
  "inline-flex size-8 cursor-pointer items-center justify-center rounded-lg border border-input bg-white text-sm font-medium text-foreground transition-colors outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/20 disabled:pointer-events-none disabled:opacity-50 max-[799px]:size-11 max-[799px]:rounded-md";

// Licznik „−  wartość  +” (web: jak „Cel snu” w Settings, 32 px; telefon: przyciski 44 px jak w MOnboarding).
export function Stepper({
  value,
  onDec,
  onInc,
  decDisabled,
  incDisabled,
  ariaLabel,
}: {
  value: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="flex items-center gap-1.5"
    >
      <button
        type="button"
        aria-label={`Zmniejsz ${ariaLabel}`}
        disabled={decDisabled}
        onClick={onDec}
        className={PRZYCISK}
      >
        −
      </button>
      <span
        className={cn(
          "inline-flex h-8 min-w-16 items-center justify-center rounded-lg border border-input bg-white px-3 font-mono text-sm text-foreground max-[799px]:h-11 max-[799px]:min-w-20 max-[799px]:rounded-md",
        )}
      >
        {value}
      </span>
      <button
        type="button"
        aria-label={`Zwiększ ${ariaLabel}`}
        disabled={incDisabled}
        onClick={onInc}
        className={PRZYCISK}
      >
        +
      </button>
    </div>
  );
}
