import { cn } from "@/lib/utils";
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
  wide = false,
}: {
  value: string;
  onDec: () => void;
  onInc: () => void;
  decDisabled?: boolean;
  incDisabled?: boolean;
  ariaLabel: string;
  // Szeroki wariant (.igroup z CSettings): jedna ramka na pełną szerokość kolumny, 32 px, przyciski po bokach z linią
  wide?: boolean;
}) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "flex items-center gap-1.5 max-[799px]:inline-flex max-[799px]:gap-0 max-[799px]:overflow-hidden max-[799px]:rounded-md max-[799px]:border max-[799px]:border-input max-[799px]:shadow-xs",
        wide &&
          "h-8 w-full gap-0 overflow-hidden rounded-md border border-input bg-white shadow-xs max-[799px]:flex max-[799px]:h-auto",
      )}
    >
      <Button
        variant="secondary"
        size="sm"
        icon
        aria-label={`Zmniejsz ${ariaLabel}`}
        disabled={decDisabled}
        onClick={onDec}
        className={cn(
          PRZYCISK,
          wide &&
            "h-[30px] rounded-none border-0 border-r border-border shadow-none focus-visible:shadow-focus-inset max-[799px]:border-r-0",
        )}
      >
        −
      </Button>
      <span
        className={cn(
          "inline-flex h-7 min-w-16 items-center justify-center rounded-md border border-input bg-white px-3 font-mono text-sm text-foreground shadow-xs max-[799px]:h-11 max-[799px]:min-w-12 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-2 max-[799px]:font-sans max-[799px]:tabular-nums max-[799px]:shadow-none",
          wide &&
            "h-full min-w-0 flex-1 rounded-none border-0 px-2 font-sans tabular-nums shadow-none max-[799px]:h-11",
        )}
      >
        {value}
      </span>
      <Button
        variant="secondary"
        size="sm"
        icon
        aria-label={`Zwiększ ${ariaLabel}`}
        disabled={incDisabled}
        onClick={onInc}
        className={cn(
          PRZYCISK,
          wide &&
            "h-[30px] rounded-none border-0 border-l border-border shadow-none focus-visible:shadow-focus-inset max-[799px]:border-l-0",
        )}
      >
        +
      </Button>
    </div>
  );
}
