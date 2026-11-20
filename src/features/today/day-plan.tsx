"use client";

// „Plan dnia” na Dziś (web, Today.dc.html): oś 00–24 (48 px na godzinę, widać 06–22),
// bloki dnia z „x/y” zadań i „TERAZ”, treningi (tylko do odczytu, link do /sport),
// czerwona linia aktualnej godziny. Dymki i okna są te same co w kalendarzu.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { StatusBadge } from "@/components/controls";
import {
  BlockDialog,
  type BlockDialogInitial,
} from "@/features/calendar/block-dialog";
import { BlockPopover } from "@/features/calendar/block-popover";
import { layoutDay } from "@/features/calendar/day-layout";
import { DeleteBlockDialog } from "@/features/calendar/delete-block-dialog";
import { NewEntryPopover } from "@/features/calendar/new-entry-popover";
import { useGridDrag } from "@/features/calendar/use-grid-drag";
import type { Occurrence } from "@/features/calendar/occurrences";
import { sportItemHref } from "@/features/sport/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import type { TodayData } from "./load-today";
import { dayPlan, nowItem } from "./model";
import type { TodayChange } from "./use-today-store";

// Wysokość godziny i widoczna część osi (06–22) jak w makiecie
const GODZINA = 48;
const WYSOKOSC_OKNA = 816;
// Półgodzina = 24 px; klik w pusty slot wybiera półgodzinę (jak w makiecie)
const POLGODZINA = GODZINA / 2;

type Okno =
  | { typ: "wpis"; startMin: number }
  | { typ: "blok"; mode: "create" | "edit"; initial: BlockDialogInitial }
  | { typ: "usun"; occurrence: Occurrence };

export function DayPlan({
  data,
  nowMin: teraz,
  applyOptimistic,
}: {
  data: TodayData;
  // Bieżąca minuta w strefie profilu (zegar co minutę w TodayView)
  nowMin: number;
  applyOptimistic: (
    zmiana: TodayChange,
    akcja: () => Promise<ActionResult>,
  ) => Promise<boolean>;
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
  const trwajacy = nowItem(plan, teraz);
  // Nakładające się wpisy dzielą szerokość (jak w siatce kalendarza)
  const uklad = layoutDay(
    plan.map((p) => ({
      key: p.key,
      startMin: p.startMin,
      durationMin: p.endMin - p.startMin,
    })),
  );

  // Wybrany blok (klucz wystąpienia) z otwartym dymkiem
  const [wybrany, setWybrany] = useState<string | null>(null);
  const [okno, setOkno] = useState<Okno | null>(null);
  const [kotwicaWpisu, setKotwicaWpisu] = useState<HTMLElement | null>(null);
  // Półgodzina pod kursorem (duch „+ 10:00–11:00”)
  const [duchMyszy, setDuchMyszy] = useState<number | null>(null);

  // Przy otwarciu: na trwający blok, a gdy go nie ma — na 06:00 (tylko przy montażu)
  const os = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const odMinuty = trwajacy ? trwajacy.startMin : 6 * 60;
    if (os.current) os.current.scrollTop = (odMinuty / 60) * GODZINA;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Przeciąganie po pustej osi zaznacza zakres i otwiera „Nowy blok” na ten czas (jak w kalendarzu)
  const { podglad, zacznij, tlumKlik } = useGridDrag({
    korzen: os,
    wysokoscGodziny: GODZINA,
    onRange: (zakres) => {
      setWybrany(null);
      setOkno({
        typ: "blok",
        mode: "create",
        initial: {
          title: "",
          categoryId: null,
          date: zakres.date,
          startMin: zakres.startMin,
          durationMin: zakres.durationMin,
          recurrence: null,
          note: "",
          remind: true,
        },
      });
    },
  });

  const wybraneWystapienie =
    plan.find((p) => p.key === wybrany)?.occurrence ?? null;

  // Półgodzina (0–47) pod wskaźnikiem
  const polgodzinaZ = (e: React.MouseEvent<HTMLElement>) =>
    Math.max(
      0,
      Math.min(
        47,
        Math.floor(
          (e.clientY - e.currentTarget.getBoundingClientRect().top) /
            POLGODZINA,
        ),
      ),
    );
  // Klik w blok, link treningu, dymek albo pole nie jest klikiem w pusty slot
  const wPusteMiejsce = (e: React.MouseEvent<HTMLElement>) =>
    !(e.target as HTMLElement).closest("button,a,[role=dialog],label,input");

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

  // Liczba wpisów osi — jak w makiecie („5 bloków” liczy też trening „Bieg 10 km”): 1 blok; 2–4, 22–24… bloki (ale 12–14 bloków); reszta bloków
  const n = plan.length;
  const napisBlokow =
    n === 1
      ? "1 blok"
      : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)
        ? `${n} bloki`
        : `${n} bloków`;

  // Aktywny slot (otwarty „Nowy wpis”) ma pierwszeństwo przed duchem myszy
  const duch = podglad
    ? null
    : okno?.typ === "wpis"
      ? okno.startMin
      : duchMyszy;
  const duchAktywny = okno?.typ === "wpis";

  return (
    <section aria-labelledby="plan-dnia" className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* .card-t */}
        <h2 id="plan-dnia" className="m-0 text-base leading-[1.3] font-semibold">
          Plan dnia
        </h2>
        <span className="text-xs text-muted-foreground">
          {`${napisBlokow} · kliknij blok, żeby zobaczyć zadania, albo puste miejsce, żeby dodać`}
        </span>
      </div>
      <div
        ref={os}
        data-testid="os-dnia"
        // .frame > .inner: ramka 1,5 px rgba(0,0,0,.14), promień 12 px
        className={`overflow-y-auto rounded-lg border-[1.5px] border-black/[.14] bg-white${podglad ? " select-none" : ""}`}
        style={{
          height: WYSOKOSC_OKNA,
          cursor: podglad ? "crosshair" : undefined,
        }}
      >
        <div
          data-testid="siatka-dnia"
          // Jedyna „kolumna” osi: z niej useGridDrag czyta dzień i górną krawędź
          data-kolumna={today}
          className="relative cursor-pointer"
          style={{
            height: 24 * GODZINA,
            backgroundImage: `repeating-linear-gradient(to bottom, #ffffff 0, #ffffff ${GODZINA - 1}px, rgba(0,0,0,.05) ${GODZINA - 1}px, rgba(0,0,0,.05) ${GODZINA}px)`,
          }}
          // Klik zaraz po przeciągnięciu nie otwiera „Nowego wpisu”
          onClickCapture={tlumKlik}
          onPointerDown={(e) => {
            if (!wPusteMiejsce(e)) return;
            zacznij(e, "create");
          }}
          onClick={(e) => {
            if (!wPusteMiejsce(e)) return;
            const startMin = polgodzinaZ(e) * 30;
            setWybrany(null);
            // Klik w ten sam slot zamyka „Nowy wpis”, w inny go przenosi
            setOkno((o) =>
              o?.typ === "wpis" && o.startMin === startMin
                ? null
                : { typ: "wpis", startMin },
            );
          }}
          onMouseMove={(e) => {
            if (!wPusteMiejsce(e)) {
              if (duchMyszy !== null) setDuchMyszy(null);
              return;
            }
            const startMin = polgodzinaZ(e) * 30;
            if (duchMyszy !== startMin) setDuchMyszy(startMin);
          }}
          onMouseLeave={() => setDuchMyszy(null)}
        >
          {Array.from({ length: 24 }, (_, h) => (
            <div
              key={h}
              aria-hidden="true"
              className="absolute left-3.5 text-xs text-muted-foreground tabular-nums"
              style={{ top: h * GODZINA + 4 }}
            >
              {godz(h * 60)}
            </div>
          ))}
          <div
            aria-hidden="true"
            className="absolute inset-y-0 left-16 border-l border-border"
          />

          {podglad && (
            <div
              data-testid="podglad-przeciagania"
              aria-hidden="true"
              // Zaznaczany zakres: przerywana ramka rgba(0,0,0,.45), tło rgba(0,0,0,.04)
              className="pointer-events-none absolute right-2.5 left-[72px] z-10 box-border overflow-hidden rounded-md border border-dashed border-black/[.45] bg-black/[.04] px-2.5 py-1.5 text-[13px] font-medium text-soft-foreground tabular-nums"
              style={{
                top: (podglad.startMin / 60) * GODZINA + 3,
                height: (podglad.durationMin / 60) * GODZINA - 6,
              }}
            >
              {`${godz(podglad.startMin)}–${godz(podglad.startMin + podglad.durationMin)}`}
            </div>
          )}

          {duch !== null && (
            <div
              ref={duchAktywny ? setKotwicaWpisu : undefined}
              aria-hidden="true"
              // Najechanie: rgba(0,0,0,.24) / .02; slot z otwartym „Nowym wpisem” jak zakres (.45 / .04)
              className={`pointer-events-none absolute right-2.5 left-[72px] z-[2] box-border rounded-md border border-dashed px-2.5 py-1.5 text-[13px] font-medium text-soft-foreground tabular-nums ${duchAktywny ? "border-black/[.45] bg-black/[.04]" : "border-black/[.24] bg-black/[.02]"}`}
              style={{ top: (duch / 60) * GODZINA + 3, height: GODZINA - 6 }}
            >
              {`+ ${godz(duch)}–${godz(Math.min(duch + 60, 1440))}`}
            </div>
          )}

          {plan.map((p) => {
            const pozycja = uklad.find((u) => u.key === p.key);
            const kolumna = pozycja?.col ?? 0;
            const kolumn = pozycja?.cols ?? 1;
            const czas = p.endMin - p.startMin;
            const godziny = `${godz(p.startMin)}–${godz(p.endMin)}`;
            // Krótkie wpisy (< 1 h) mieszczą jedną linię
            const kompakt = czas < 60;
            const licznik = p.planned
              ? "plan"
              : p.tasksTotal > 0
                ? `${p.tasksDone}/${p.tasksTotal}`
                : "";
            const trwa = trwajacy?.key === p.key;
            const zaznaczony = wybrany === p.key;
            const styl: React.CSSProperties = {
              top: (p.startMin / 60) * GODZINA + 3,
              height: Math.max((czas / 60) * GODZINA - 6, 14),
              // Pas od 72 px do 10 px przed prawą krawędzią, dzielony na kolumny nakładających się wpisów
              left: `calc(72px + (100% - 82px) * ${kolumna / kolumn})`,
              width: `calc((100% - 82px) / ${kolumn} - ${kolumn > 1 ? 4 : 0}px)`,
              // CToday: tło kolor+12, ramka 1 px kolor+4d, bez paska po lewej;
              // zaznaczony ma pierścień 2 px biały + 4 px kolor+66
              background: `${p.color}12`,
              border: `1px solid ${p.color}4d`,
              boxShadow: zaznaczony
                ? `0 0 0 2px #fff, 0 0 0 4px ${p.color}66`
                : undefined,
            };
            const tresc = (
              <>
                <span className="flex w-full items-center gap-2">
                  <span className="truncate font-medium">
                    {kompakt ? `${p.title} · ${godz(p.startMin)}` : p.title}
                  </span>
                  {trwa && <StatusBadge tone="green">TERAZ</StatusBadge>}
                  {licznik && (
                    <StatusBadge tone="outline" className="ml-auto tabular-nums">
                      {licznik}
                    </StatusBadge>
                  )}
                </span>
                {!kompakt && (
                  <span className="block truncate text-xs text-soft-foreground tabular-nums">
                    {`${godziny} · ${p.categoryName ?? "Bez kategorii"}`}
                  </span>
                )}
              </>
            );
            const klasy = `absolute box-border flex flex-col items-stretch gap-0.5 overflow-hidden rounded-md text-left text-sm leading-[1.3] text-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus ${kompakt ? "justify-center px-2.5 py-0" : "justify-start px-2.5 py-1.5"}`;

            // Trening: tylko do odczytu, prowadzi do jego podglądu na /sport
            if (p.kind !== "block") {
              return (
                <Link
                  key={p.key}
                  href={sportItemHref({ date: today, key: p.key })}
                  title={`${p.title} ${godziny}`}
                  className={klasy}
                  style={styl}
                >
                  {tresc}
                </Link>
              );
            }
            return (
              <button
                key={p.key}
                type="button"
                data-occurrence-key={p.key}
                aria-pressed={zaznaczony}
                title={`${p.title} ${godziny}`}
                // Ponowny klik w ten sam blok zamyka dymek
                onClick={() => {
                  setOkno((o) => (o?.typ === "wpis" ? null : o));
                  setWybrany((w) => (w === p.key ? null : p.key));
                }}
                className={`${klasy} cursor-pointer`}
                style={styl}
              >
                {tresc}
              </button>
            );
          })}

          <div
            data-testid="linia-teraz"
            aria-hidden="true"
            className="pointer-events-none absolute right-0 left-14 border-t-2 border-destructive"
            style={{ top: (teraz / 60) * GODZINA }}
          />
          <span
            data-testid="etykieta-teraz"
            aria-hidden="true"
            // Etykieta godziny: biała na #ef4444, promień 6 px, 11 px / 500
            className="pointer-events-none absolute left-2 rounded-sm bg-destructive px-[5px] py-0.5 text-[11px] font-medium text-white tabular-nums"
            style={{ top: (teraz / 60) * GODZINA - 10 }}
          >
            {godz(teraz)}
          </span>
        </div>
      </div>

      {wybraneWystapienie && (
        <BlockPopover
          // Blok na Dziś zajmuje całą szerokość osi: dymek pod blokiem (Radix przerzuca nad
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
      {okno?.typ === "wpis" && (
        <NewEntryPopover
          side="bottom"
          anchor={kotwicaWpisu}
          date={today}
          startMin={okno.startMin}
          clock={clock}
          onBlock={() =>
            setOkno({
              typ: "blok",
              mode: "create",
              initial: {
                title: "",
                categoryId: null,
                date: today,
                startMin: okno.startMin,
                // Blok nie przechodzi przez północ
                durationMin: Math.min(60, 1440 - okno.startMin),
                recurrence: null,
                note: "",
                remind: true,
              },
            })
          }
          onClose={() => setOkno(null)}
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
