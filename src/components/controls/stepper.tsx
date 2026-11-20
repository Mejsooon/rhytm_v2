import { Button } from "./button";

// Licznik „−  wartość  +”.
// Web: przyciski jak .btn.sm.ic (28 px) i osobne pole wartości.
// Telefon: jedna ramka z przyciskami 44 px jak .m-step z CMToday.dc.html.
// Fokus na telefonie w środku przycisku (shadow-focus-inset) — ramka z overflow-hidden ucinała pierścień
const PRZYCISK =
  "max-[799px]:size-11 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:text-lg max-[799px]:shadow-none max-[799px]:focus-visible:shadow-focus-inset";

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
      className="flex items-center gap-1.5 max-[799px]:inline-flex max-[799px]:gap-0 max-[799px]:overflow-hidden max-[799px]:rounded-md max-[799px]:border max-[799px]:border-input max-[799px]:shadow-xs"
    >
      <Button
        variant="secondary"
        size="sm"
        icon
        aria-label={`Zmniejsz ${ariaLabel}`}
        disabled={decDisabled}
        onClick={onDec}
        className={PRZYCISK}
      >
        −
      </Button>
      <span className="inline-flex h-7 min-w-16 items-center justify-center rounded-md border border-input bg-white px-3 font-mono text-sm text-foreground shadow-xs max-[799px]:h-11 max-[799px]:min-w-12 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-2 max-[799px]:font-sans max-[799px]:tabular-nums max-[799px]:shadow-none">
        {value}
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon
        aria-label={`Zwiększ ${ariaLabel}`}
        disabled={incDisabled}
        onClick={onInc}
        className={PRZYCISK}
      >
        +
      </Button>
    </div>
  );
}
