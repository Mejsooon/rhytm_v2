"use client";

// Klientowy korzeń kalendarza: nagłówek, filtry kategorii i wybrany widok.
// Web: tydzień i dzień to siatka godzin (Task 6); miesiąc i telefon dojdą w Taskach 10 i 11 — na razie prosta lista dni.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { IsoDate } from "@/components/controls/calendar-math";
import { setCategoryHidden } from "@/features/categories/actions";
import { BlockPopover } from "./block-popover";
import { CalendarHeader } from "./calendar-header";
import { CategoryFilters } from "./category-filters";
import { DaySide } from "./day-side";
import type { CalendarData, CategoryRow } from "./load-calendar";
import { expandOccurrences } from "./occurrences";
import { TimeGrid } from "./time-grid";
import { useCalendarStore } from "./use-calendar-store";
import { viewRange, type CalendarView } from "./view-range";

function godzina(minuty: number): string {
  const h = String(Math.floor(minuty / 60)).padStart(2, "0");
  const m = String(minuty % 60).padStart(2, "0");
  return `${h}:${m}`;
}

export function CalendarView({
  view,
  date,
  today,
  nowMinutes,
  data: daneSerwera,
}: {
  view: CalendarView;
  date: IsoDate;
  today: IsoDate;
  // Aktualna godzina w strefie profilu, liczona na serwerze; użyją jej widoki z linią „teraz”
  nowMinutes: number;
  data: CalendarData;
}) {
  const router = useRouter();
  const { data, applyOptimistic } = useCalendarStore(daneSerwera);
  const { weekStart } = data.profile;
  const zakres = useMemo(() => viewRange(view, date, weekStart), [view, date, weekStart]);

  // Wybrany blok: klucz wystąpienia i element, przy którym otwiera się dymek
  const [wybrany, setWybrany] = useState<{ key: string; anchor: HTMLElement } | null>(null);

  const wystapienia = useMemo(
    () => expandOccurrences(data.blocks, data.exceptions, zakres.from, zakres.to),
    [data.blocks, data.exceptions, zakres.from, zakres.to],
  );

  // Liczniki chipów liczą też wystąpienia ukrytych kategorii
  const liczniki = useMemo(() => {
    const wynik: Record<string, number> = {};
    for (const o of wystapienia) {
      if (o.categoryId) wynik[o.categoryId] = (wynik[o.categoryId] ?? 0) + 1;
    }
    return wynik;
  }, [wystapienia]);

  const ukryte = new Set(data.categories.filter((k) => k.hidden).map((k) => k.id));
  const widoczne = wystapienia.filter((o) => !o.categoryId || !ukryte.has(o.categoryId));

  // Ukrycie od razu znika z widoku; błąd zapisu cofa zmianę i pokazuje toast (w store)
  function przelaczKategorie(kategoria: CategoryRow) {
    const hidden = !kategoria.hidden;
    void applyOptimistic(
      (d) => ({
        ...d,
        categories: d.categories.map((k) =>
          k.id === kategoria.id ? { ...k, hidden } : k,
        ),
      }),
      () => setCategoryHidden({ id: kategoria.id, hidden }),
    );
  }

  const wybraneWystapienie = wybrany
    ? widoczne.find((o) => o.key === wybrany.key)
    : undefined;

  const placeholder = (
    // Tymczasowy widok: lista wystąpień dzień po dniu (zastąpią go Taski 10 i 11)
    <div className="flex flex-col gap-3">
      {zakres.days.map((dzien) => {
        const dzienne = widoczne.filter((o) => o.date === dzien);
        if (dzienne.length === 0) return null;
        return (
          <section key={dzien}>
            <h3 className="font-mono text-xs text-[#6b6b6b]">{dzien}</h3>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {dzienne.map((o) => (
                <li key={o.key}>
                  <span className="font-mono text-xs text-[#6b6b6b]">{godzina(o.startMin)}</span>{" "}
                  {o.title}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );

  const siatka = (
    <TimeGrid
      days={zakres.days}
      occurrences={widoczne}
      categories={data.categories}
      tasks={data.tasks}
      clock={data.profile.clock}
      today={today}
      nowMinutes={nowMinutes}
      variant={view === "dzien" ? "day" : "week"}
      totalCount={view === "dzien" ? wystapienia.length : undefined}
      // Ponowny klik w ten sam blok zamyka dymek
      onBlockClick={(key, anchor) =>
        setWybrany((w) => (w?.key === key ? null : { key, anchor }))
      }
      // TODO(Task 8): okno nowego wpisu
      onSlotClick={() => {}}
    />
  );

  return (
    <>
      <CalendarHeader
        view={view}
        date={date}
        today={today}
        weekStart={weekStart}
        // TODO(Task 8): okno nowego bloku
        onNewBlock={() => {}}
      />
      <div className="flex flex-col gap-3.5 px-6 pt-4 pb-6 max-[799px]:px-4">
        <CategoryFilters
          categories={data.categories}
          counts={liczniki}
          onToggle={przelaczKategorie}
          // TODO(Task 8): okno nowej kategorii
          onAdd={() => {}}
        />
        {view === "tydzien" && <div className="max-[799px]:hidden">{siatka}</div>}
        {view === "dzien" && (
          // TODO(Task 11): widok dnia na telefonie
          <div className="flex flex-wrap items-start gap-6 max-[799px]:hidden">
            <div className="min-w-0 flex-[999_1_520px]">{siatka}</div>
            <DaySide
              date={date}
              today={today}
              weekStart={weekStart}
              occurrences={widoczne.filter((o) => o.date === date)}
              tasks={data.tasks}
              onPick={(dzien) => router.push(`/kalendarz?widok=dzien&data=${dzien}`)}
            />
          </div>
        )}
        {/* TODO(Task 11): tydzień na telefonie; miesiąc: Task 10 */}
        {view === "miesiac" && placeholder}
      </div>
      {wybrany && wybraneWystapienie && (
        <BlockPopover
          occurrence={wybraneWystapienie}
          anchor={wybrany.anchor}
          tasks={data.tasks}
          category={data.categories.find((k) => k.id === wybraneWystapienie.categoryId)}
          clock={data.profile.clock}
          applyOptimistic={applyOptimistic}
          // TODO(Task 8): okno edycji bloku
          onEdit={() => {}}
          // TODO(Task 8): okno usuwania bloku
          onDelete={() => {}}
          onClose={() => setWybrany(null)}
        />
      )}
    </>
  );
}
