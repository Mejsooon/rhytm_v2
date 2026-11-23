"use client";

// „Plan dnia” na Dziś (web, S2Today): lista na całą dobę — wiersze bloków i treningów
// poprzedzielane przerwami „N h wolne”, na końcu pusty wiersz 23:00. Klik w blok otwiera
// dymek z zadaniami (ten sam co w kalendarzu), klik w przerwę — „Nowy blok” od jej początku.
// Trening jest tylko do odczytu i prowadzi do /sport.
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, StatusBadge } from "@/components/controls";
import {
  BlockDialog,
  type BlockDialogInitial,
} from "@/features/calendar/block-dialog";
import { BlockPopover } from "@/features/calendar/block-popover";
import { DeleteBlockDialog } from "@/features/calendar/delete-block-dialog";
import type { Occurrence } from "@/features/calendar/occurrences";
import { sportItemHref } from "@/features/sport/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { TodayData } from "./load-today";
import { blocksCountLabel, dayPlan, dayPlanRows, nowItem } from "./model";
import type { TodayChange } from "./use-today-store";

type Okno =
  | { typ: "blok"; mode: "create" | "edit"; initial: BlockDialogInitial }
  | { typ: "usun"; occurrence: Occurrence };

export function DayPlan({
  data,
  nowMin: teraz,
  applyOptimistic,
  onNewBlock,
}: {
  data: TodayData;
  // Bieżąca minuta w strefie profilu (zegar co minutę w TodayView)
  nowMin: number;
  applyOptimistic: (
    zmiana: TodayChange,
    akcja: () => Promise<ActionResult>,
  ) => Promise<boolean>;
  // „Dodaj pierwszy blok” w pustym dniu — to samo okno co „Nowy blok” w nagłówku
  onNewBlock: () => void;
}) {
  const router = useRouter();
  const { today, profile } = data;
  const { clock } = profile;

  const plan = dayPlan(
    data.occurrencesToday,
    data.categories,
    data.tasks,
    data.sportItems,
    today,
  );
  const wiersze = dayPlanRows(plan);
  const trwajacy = nowItem(plan, teraz);

  // Wybrany blok (klucz wystąpienia) z otwartym dymkiem
  const [wybrany, setWybrany] = useState<string | null>(null);
  const [okno, setOkno] = useState<Okno | null>(null);

  const wybraneWystapienie =
    plan.find((p) => p.key === wybrany)?.occurrence ?? null;

  const godz = (minuty: number) =>
    formatClockTime(Math.floor(minuty / 60), minuty % 60, clock);

  function edytuj(o: Occurrence) {
    setWybrany(null);
    // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
    const dataOryginalna = o.key.slice(o.blockId.length + 1);
    setOkno({
      typ: "blok",
      mode: "edit",
      initial: {
        title: o.title,
        categoryId: o.categoryId,
        date: o.date,
        startMin: o.startMin,
        durationMin: o.durationMin,
        recurrence: o.recurrence,
        note: o.note ?? "",
        remind: o.remind,
        blockId: o.blockId,
        occurrenceDate: dataOryginalna,
        // Start serii zawsze należy do serii, więc pierwsze wystąpienie ma datę startu bloku
        firstOccurrence:
          data.blocks
            .find((b) => b.id === o.blockId)
            ?.start_local.slice(0, 10) === dataOryginalna,
      },
    });
  }

  // Wiersz z etykietą godziny w kolumnie 56 px (.hr-row / .gap), linia rgba(0,0,0,.06) nad nim
  const wiersz =
    "grid grid-cols-[56px_1fr] border-t border-black/[.06] first:border-t-0";

  return (
    <section aria-labelledby="plan-dnia" className="flex min-w-0 flex-col gap-3">
      <div className="flex items-baseline justify-between">
        {/* .card-t */}
        <h2 id="plan-dnia" className="m-0 text-base leading-[1.3] font-semibold">
          Plan dnia
        </h2>
        {/* Liczba wpisów jak w makiecie („4 bloki” liczy też trening) */}
        <span className="text-xs text-muted-foreground">
          {`00:00–24:00 · ${blocksCountLabel(plan.length)}`}
        </span>
      </div>
      {/* .frame > .inner: ramka 1,5 px rgba(0,0,0,.14), promień 12 px, padding 10/12/4;
          interlinia „normal” jak w makiecie (wiersz z blokiem mieści się w ~48 px) */}
      <div
        data-testid="plan-dnia-lista"
        className="overflow-hidden rounded-lg border-[1.5px] border-black/[.14] bg-white px-3 pt-2.5 pb-1 leading-[normal]"
      >
        {wiersze.map((w) => {
          if (w.type === "gap") {
            // Klik w przerwę: „Nowy blok” od początku przerwy zaokrąglonego w górę do pełnej godziny
            // (najpóźniej 23:00), 60 min
            const start = Math.min(Math.ceil(w.startMin / 60) * 60, 23 * 60);
            return (
              <div
                key={`gap-${w.startMin}`}
                data-testid="przerwa"
                // .gap: min. 30 px, środek; .gap-big (≥ 3 h): min. 84 px, godzina u góry
                className={`${wiersz} ${w.big ? "min-h-[84px] items-stretch" : "min-h-[30px] items-center"}`}
              >
                <span
                  className={`text-xs text-muted-foreground tabular-nums ${w.big ? "pt-2" : ""}`}
                >
                  {godz(w.startMin)}
                </span>
                <button
                  type="button"
                  title={`Dodaj blok od ${godz(start)}`}
                  onClick={() => {
                    setWybrany(null);
                    setOkno({
                      typ: "blok",
                      mode: "create",
                      initial: {
                        title: "",
                        categoryId: null,
                        date: today,
                        startMin: start,
                        durationMin: 60,
                        recurrence: null,
                        note: "",
                        remind: true,
                      },
                    });
                  }}
                  // Tekst przerwy między przerywanymi liniami rgba(0,0,0,.14)
                  className="flex w-full cursor-pointer items-center gap-2 self-center text-xs text-muted-foreground tabular-nums outline-none before:flex-1 before:border-t before:border-dashed before:border-black/[.14] before:content-[''] after:flex-1 after:border-t after:border-dashed after:border-black/[.14] after:content-[''] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid"
                >
                  {w.label}
                </button>
              </div>
            );
          }

          const p = w.item;
          const godziny = `${godz(p.startMin)}–${godz(p.endMin)}`;
          const trwa = trwajacy?.key === p.key;
          const zaznaczony = wybrany === p.key;
          // Odznaka po prawej: trening „plan”/„zrobione”, blok „x/y” zadań (bez zadań — brak)
          const odznaka =
            p.kind !== "block"
              ? p.planned
                ? "plan"
                : "zrobione"
              : p.tasksTotal > 0
                ? `${p.tasksDone}/${p.tasksTotal}`
                : "";
          // .blk: tło kolor+12, ramka 1 px kolor+4d (jak w kalendarzu); trwający — pierścień
          // 2 px biały + 1 px kolor+59, otwarty dymek — 2 px biały + 2 px kolor+66
          const styl: React.CSSProperties = {
            background: `${p.color}12`,
            border: `1px solid ${p.color}4d`,
            boxShadow: zaznaczony
              ? `0 0 0 2px #fff, 0 0 0 4px ${p.color}66`
              : trwa
                ? `0 0 0 2px #fff, 0 0 0 3px ${p.color}59`
                : undefined,
          };
          const tresc = (
            <>
              <span className="min-w-0">
                <b className="font-medium">{p.title}</b>
                {trwa && (
                  <>
                    {" "}
                    <StatusBadge tone="green">Teraz</StatusBadge>
                  </>
                )}
                <br />
                <span className="text-xs text-muted-foreground tabular-nums">
                  {`${godziny} · ${p.categoryName ?? "Bez kategorii"}`}
                </span>
              </span>
              {odznaka && (
                <StatusBadge tone="gray" className="shrink-0 tabular-nums">
                  {odznaka}
                </StatusBadge>
              )}
            </>
          );
          // Fokus jako outline z odstępem: inline boxShadow pierścienia nie może go zasłonić
          const klasy =
            "my-1 box-border flex w-full items-start justify-between gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] text-foreground no-underline outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring focus-visible:outline-solid";

          return (
            <div
              key={p.key}
              data-testid="wiersz-planu"
              // .hr-row: min. 48 px, godzina z odstępem 6 px od góry
              className={`${wiersz} min-h-12`}
            >
              <span className="pt-1.5 text-xs text-muted-foreground tabular-nums">
                {godz(p.startMin)}
              </span>
              <div className="min-w-0">
                {p.kind !== "block" ? (
                  // Trening: tylko do odczytu, prowadzi do jego podglądu na /sport
                  <Link
                    href={sportItemHref({ date: today, key: p.key })}
                    title={`${p.title} ${godziny}`}
                    className={klasy}
                    style={styl}
                  >
                    {tresc}
                  </Link>
                ) : (
                  <button
                    type="button"
                    data-occurrence-key={p.key}
                    aria-pressed={zaznaczony}
                    title={`${p.title} ${godziny}`}
                    // Ponowny klik w ten sam blok zamyka dymek
                    onClick={() => setWybrany((x) => (x === p.key ? null : p.key))}
                    className={`${klasy} cursor-pointer`}
                    style={styl}
                  >
                    {tresc}
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {/* Pusty dzień: zachęta pod przerwą „24 h wolne” */}
        {plan.length === 0 && (
          <div className="grid grid-cols-[56px_1fr] pb-5">
            <span />
            <div className="flex flex-col items-center gap-2.5">
              <span className="text-xs text-muted-foreground">
                Nie masz jeszcze bloków na dziś.
              </span>
              <Button onClick={onNewBlock}>
                <Plus size={16} aria-hidden="true" />
                Dodaj pierwszy blok
              </Button>
            </div>
          </div>
        )}

        {/* Zawsze ostatni, pusty wiersz 23:00 (min. 40 px) */}
        <div aria-hidden="true" className={`${wiersz} min-h-10`}>
          <span className="pt-2 text-xs text-muted-foreground tabular-nums">
            {godz(23 * 60)}
          </span>
          <div />
        </div>
      </div>

      {wybraneWystapienie && (
        <BlockPopover
          // Blok zajmuje całą szerokość listy: dymek pod blokiem (Radix przerzuca nad
          // blok przy dolnej krawędzi i przesuwa w poziomie, żeby nie wyszedł poza stronę)
          side="bottom"
          occurrence={wybraneWystapienie}
          tasks={data.tasks}
          category={data.categories.find(
            (k) => k.id === wybraneWystapienie.categoryId,
          )}
          clock={clock}
          applyOptimistic={applyOptimistic}
          onEdit={() => edytuj(wybraneWystapienie)}
          onDelete={() => {
            setWybrany(null);
            setOkno({ typ: "usun", occurrence: wybraneWystapienie });
          }}
          onClose={() => setWybrany(null)}
        />
      )}
      {okno?.typ === "blok" && (
        <BlockDialog
          mode={okno.mode}
          initial={okno.initial}
          categories={data.categories}
          clock={clock}
          weekStart={profile.weekStart}
          today={today}
          onSaved={() => {
            setOkno(null);
            // Akcje bloku odświeżają tylko /kalendarz, więc Dziś pobiera dane sam
            router.refresh();
          }}
          onCancel={() => setOkno(null)}
        />
      )}
      {okno?.typ === "usun" && (
        <DeleteBlockDialog
          occurrence={okno.occurrence}
          clock={clock}
          onDeleted={() => {
            setOkno(null);
            router.refresh();
          }}
          onCancel={() => setOkno(null)}
        />
      )}
    </section>
  );
}
