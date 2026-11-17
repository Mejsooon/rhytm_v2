"use client";

// Filtry kategorii wg Calendar.dc.html: „POKAŻ”, chipy z kropką i licznikiem, „+ Kategoria”.
// Ukryta kategoria: przerywana ramka, tło #fafafa i pusta kropka.
import { MonoLabel } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { CategoryRow } from "./load-calendar";

export function CategoryFilters({
  categories,
  counts,
  onToggle,
  onAdd,
}: {
  categories: CategoryRow[];
  // liczba wystąpień w widoku wg id kategorii
  counts: Record<string, number>;
  onToggle: (category: CategoryRow) => void;
  // Okno nowej kategorii podepnie Task 8
  onAdd?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <MonoLabel className="mr-1">Pokaż</MonoLabel>
      {categories.map((kategoria) => {
        const widoczna = !kategoria.hidden;
        return (
          <button
            key={kategoria.id}
            type="button"
            aria-pressed={widoczna}
            onClick={() => onToggle(kategoria)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-sm",
              widoczna
                ? "border-[#e0e0e0] bg-white text-[#404040]"
                : "border-dashed border-[#e0e0e0] bg-[#fafafa] text-[#6b6b6b]",
            )}
          >
            <span
              aria-hidden="true"
              className="box-border size-2 rounded-full"
              style={
                widoczna
                  ? { background: kategoria.color }
                  : { border: `1.5px solid ${kategoria.color}` }
              }
            />
            {kategoria.name}
            <span className="font-mono text-[#6b6b6b]">{counts[kategoria.id] ?? 0}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[#e0e0e0] bg-white px-2.5 py-1 text-xs text-[#666666] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:h-9 max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-sm"
      >
        + Kategoria
      </button>
    </div>
  );
}
