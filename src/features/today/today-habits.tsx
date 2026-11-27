// „Nawyki na dziś” wg S2Today: siatka kafelków (zawsze 4 kolumny, jak w makiecie). Kafelek to przycisk
// aria-pressed z nazwą, polem odhaczenia i passą. Bez nawyków na dziś jeden przerywany kafelek
// „Utwórz nowy nawyk” (S2EmptyToday). Lista przychodzi gotowa z `todayHabits` (model.ts).
import { Fragment } from "react";
import { Check, Flame, Plus } from "lucide-react";

import type { IsoDate } from "@/components/controls/calendar-math";
import { HabitQtyPopover } from "@/features/habits/habit-qty-popover";

import type { TodayHabit } from "./model";

export function TodayHabits({
  habits,
  onToggle,
  onCreate,
  today,
  progress = [],
}: {
  habits: TodayHabit[];
  onToggle: (habitId: string) => void;
  onCreate: () => void;
  today?: IsoDate;
  progress?: Array<{ habitId: string; qty: number }>;
}) {
  const odhaczone = habits.filter((h) => h.done).length;

  // .htile: kolumna, odstęp 8 px, padding 14/16, promień 12 px, ramka rgba(0,0,0,.1), cień xs
  const kafelek =
    "flex cursor-pointer flex-col items-start gap-2 rounded-lg border border-black/10 bg-white px-4 py-3.5 text-left text-sm leading-[normal] text-foreground shadow-[0_1px_2px_rgba(0,0,0,.04)] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

  return (
    <section aria-labelledby="nawyki-na-dzis" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        {/* .card-t */}
        <h2
          id="nawyki-na-dzis"
          className="m-0 text-base leading-[1.3] font-semibold"
        >
          Nawyki na dziś
        </h2>
        {/* Licznik „odhaczone / wszystkie” tylko przy nawykach na dziś */}
        {habits.length > 0 && (
          <span
            data-testid="licznik-nawykow"
            className="text-xs text-muted-foreground tabular-nums"
          >
            {`${odhaczone} / ${habits.length}`}
          </span>
        )}
      </div>
      <div className="grid grid-cols-4 gap-3">
        {habits.length === 0 ? (
          // Przerywana ramka, bez cienia, treść w rzędzie na środku, min. 74 px, szary tekst
          <button
            type="button"
            onClick={onCreate}
            className={`${kafelek} min-h-[74px] flex-row items-center justify-center border-dashed text-muted-foreground shadow-none hover:bg-[#fafafa]`}
          >
            <Plus size={16} aria-hidden="true" />
            Utwórz nowy nawyk
          </button>
        ) : (
          habits.map((h) => {
            const przycisk = (
            <button
              type="button"
              aria-pressed={h.done}
              onClick={h.goal ? undefined : () => onToggle(h.id)}
              // Odhaczony: ramka rgba(0,0,0,.24), tło rgba(0,0,0,.02)
              className={`${kafelek} ${h.done ? "border-black/[.24] bg-black/[.02]" : "hover:bg-[#fafafa]"}`}
            >
              <span className="flex w-full items-center justify-between gap-2">
                <span className="min-w-0 truncate font-medium">{h.name}</span>
                {/* .hcbx: 18 px, promień 6 px, ramka 1,5 px rgba(0,0,0,.3); odhaczone #262626 */}
                <span
                  aria-hidden="true"
                  className={`box-border grid size-[18px] shrink-0 place-items-center rounded-sm border-[1.5px] ${h.done ? "border-foreground bg-foreground text-[#fafafa]" : "border-black/30"}`}
                >
                  {h.done && <Check size={14} strokeWidth={2.5} />}
                </span>
              </span>
              {/* .hint: passa; od 3 płomień i tekst #c2410c */}
              <span
                className={`inline-flex items-center gap-1 text-xs ${h.hot ? "text-[#c2410c]" : "text-muted-foreground"}`}
              >
                {h.streak.value >= 1 && <Flame size={14} aria-hidden="true" />}
                {h.streakLabel}
              </span>
            </button>
            );
            return h.goal && today ? (
              <HabitQtyPopover
                key={h.id}
                habit={{ id: h.id, name: h.name, goalQty: h.goal.qty, goalUnit: h.goal.unit }}
                date={today}
                qty={progress.find((p) => p.habitId === h.id)?.qty ?? 0}
                done={h.done}
                trigger={przycisk}
              />
            ) : (
              <Fragment key={h.id}>{przycisk}</Fragment>
            );
          })
        )}
      </div>
    </section>
  );
}
