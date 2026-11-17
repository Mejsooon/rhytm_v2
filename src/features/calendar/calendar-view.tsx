"use client";

// Klientowy korzeń kalendarza: nagłówek, filtry kategorii i wybrany widok.
// Web: tydzień i dzień to siatka godzin (Task 6); miesiąc i telefon dojdą w Taskach 10 i 11 — na razie prosta lista dni.
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import type { IsoDate } from "@/components/controls/calendar-math";
import { setCategoryHidden } from "@/features/categories/actions";
import { CategoryDialog, type NewCategory } from "@/features/categories/category-dialog";
import { formatClockTime } from "@/lib/time/timezones";
import { changeOccurrence } from "./actions";
import { BlockDialog, type BlockDialogInitial } from "./block-dialog";
import { BlockPopover } from "./block-popover";
import { CalendarHeader } from "./calendar-header";
import { CategoryFilters } from "./category-filters";
import { DaySide } from "./day-side";
import { DeleteBlockDialog } from "./delete-block-dialog";
import type { DragResult } from "./drag";
import type { CalendarData, CategoryRow } from "./load-calendar";
import { NewEntryPopover } from "./new-entry-popover";
import { expandOccurrences, type Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import { ScopeDialog } from "./scope-dialog";
import { planScopeChange, type BlockPatch, type Scope } from "./scope";
import { TimeGrid } from "./time-grid";
import { useCalendarStore, type CalendarChange } from "./use-calendar-store";
import { viewRange, type CalendarView } from "./view-range";

function godzina(minuty: number): string {
  const h = String(Math.floor(minuty / 60)).padStart(2, "0");
  const m = String(minuty % 60).padStart(2, "0");
  return `${h}:${m}`;
}

// Otwarte okno kalendarza; okna nie zmieniają adresu, więc widok i data zostają jak były
type Okno =
  | { typ: "wpis"; date: IsoDate; startMin: number }
  | { typ: "blok"; mode: "create" | "edit"; initial: BlockDialogInitial }
  | { typ: "kategoria" }
  | { typ: "usun"; occurrence: Occurrence }
  // Przeciągnięty blok cykliczny czeka na wybór zakresu zmiany
  | { typ: "przeciagniecie"; occurrence: Occurrence; wynik: DragResult };

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
  const [wybrany, setWybrany] = useState<string | null>(null);
  // Okno nowego wpisu / bloku / kategorii / usuwania (naraz tylko jedno) i kotwica dymku „Nowy wpis”
  const [okno, setOkno] = useState<Okno | null>(null);
  const [kotwicaWpisu, setKotwicaWpisu] = useState<HTMLElement | null>(null);
  // Miejsce, w którym blok stoi po puszczeniu, zanim zapis się skończy (albo „Anuluj” go cofnie)
  const [podgladBloku, setPodgladBloku] = useState<({ key: string } & DragResult) | null>(null);
  // Zmiana widoku albo dnia zamyka dymek (stan ustawiany w renderze, jak w store)
  const [widokDla, setWidokDla] = useState(`${view}|${date}`);
  if (widokDla !== `${view}|${date}`) {
    setWidokDla(`${view}|${date}`);
    setWybrany(null);
    setOkno((o) => (o?.typ === "wpis" ? null : o));
  }

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

  // Nowa kategoria od razu trafia do danych, żeby chip był od razu widoczny. To wiersz zastępczy
  // (user_id i position przybliżone): po zapisie akcja odświeża stronę i dane z serwera z tym samym
  // id zastępują go prawdziwym wierszem.
  function dodajKategorie(nowa: NewCategory) {
    void applyOptimistic(
      (d) =>
        d.categories.some((k) => k.id === nowa.id)
          ? d
          : {
              ...d,
              categories: [
                ...d.categories,
                {
                  id: nowa.id,
                  name: nowa.name,
                  color: nowa.color,
                  hidden: false,
                  is_system: false,
                  position: Math.max(0, ...d.categories.map((k) => k.position)) + 1,
                  user_id: d.categories[0]?.user_id ?? "",
                  created_at: null,
                },
              ],
            },
      async () => ({ ok: true }),
    );
  }

  // Na siatce blok czekający na zakres albo zapis stoi już na nowym miejscu
  const naSiatce = podgladBloku
    ? widoczne.map((o) =>
        o.key === podgladBloku.key
          ? {
              ...o,
              date: podgladBloku.date,
              startMin: podgladBloku.startMin,
              durationMin: podgladBloku.durationMin,
            }
          : o,
      )
    : widoczne;

  // Start serii zawsze należy do serii, więc pierwsze wystąpienie ma datę startu bloku
  function pierwszeWystapienie(o: Occurrence): boolean {
    return (
      data.blocks.find((b) => b.id === o.blockId)?.start_local.slice(0, 10) ===
      o.key.slice(o.blockId.length + 1)
    );
  }

  // Zapis przesunięcia/rozciągnięcia: blok od razu stoi na nowym miejscu, błąd cofa i daje toast
  function zapiszPrzeciagniecie(o: Occurrence, zakres: Scope, wynik: DragResult) {
    // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
    const dataOryginalna = o.key.slice(o.blockId.length + 1);
    const patch: BlockPatch = {};
    if (wynik.date !== o.date) patch.date = wynik.date;
    if (wynik.startMin !== o.startMin) patch.startMin = wynik.startMin;
    if (wynik.durationMin !== o.durationMin) patch.durationMin = wynik.durationMin;

    // Optymistyczna zmiana z tego samego planu, który wykona akcja; podział serii
    // zostaje do odświeżenia danych (do tego czasu blok trzyma podgląd)
    const blok = data.blocks.find((b) => b.id === o.blockId);
    const plan = blok ? planScopeChange({ block: blok, occurrence: o, scope: zakres, patch }) : null;
    const zmiana: CalendarChange = (d) => {
      if (plan?.kind === "updateBlock") {
        const p = plan.patch;
        return {
          ...d,
          blocks: d.blocks.map((b) =>
            b.id !== o.blockId
              ? b
              : {
                  ...b,
                  start_local: `${p.date ?? b.start_local.slice(0, 10)}T${
                    p.startMin === undefined ? b.start_local.slice(11, 19) : `${godzina(p.startMin)}:00`
                  }`,
                  duration_min: p.durationMin ?? b.duration_min,
                },
          ),
        };
      }
      if (plan?.kind === "upsertException") {
        return {
          ...d,
          exceptions: [
            ...d.exceptions.filter(
              (w) => !(w.block_id === plan.row.block_id && w.occurrence_date === plan.row.occurrence_date),
            ),
            plan.row,
          ],
        };
      }
      return d;
    };

    void applyOptimistic(zmiana, () =>
      changeOccurrence({ blockId: o.blockId, date: dataOryginalna, scope: zakres, patch }),
    ).finally(() => setPodgladBloku(null));
  }

  // Puszczony blok: bez zmiany nic się nie dzieje, jednorazowy zapisuje się od razu,
  // cykliczny najpierw pyta o zakres (podgląd zostaje na nowym miejscu)
  function przeciagnietyBlok(o: Occurrence, wynik: DragResult) {
    setWybrany(null);
    if (wynik.date === o.date && wynik.startMin === o.startMin && wynik.durationMin === o.durationMin) return;
    if (!o.recurring) {
      zapiszPrzeciagniecie(o, "all", wynik);
      return;
    }
    setPodgladBloku({ key: o.key, ...wynik });
    setOkno({ typ: "przeciagniecie", occurrence: o, wynik });
  }

  // Przeciągnięty zakres na pustej siatce otwiera okno nowego bloku z tym zakresem
  function przeciagnietyZakres(zakres: DragResult) {
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
  }

  const wybraneWystapienie = wybrany
    ? widoczne.find((o) => o.key === wybrany)
    : undefined;
  // Wystąpienie zniknęło (ukryta kategoria, usunięty blok): wybór się czyści,
  // więc dymek nie wraca po ponownym pokazaniu kategorii
  if (wybrany && !wybraneWystapienie) setWybrany(null);

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
      occurrences={naSiatce}
      categories={data.categories}
      tasks={data.tasks}
      clock={data.profile.clock}
      today={today}
      nowMinutes={nowMinutes}
      variant={view === "dzien" ? "day" : "week"}
      totalCount={view === "dzien" ? wystapienia.length : undefined}
      // Ponowny klik w ten sam blok zamyka dymek
      onBlockClick={(key) => setWybrany((w) => (w === key ? null : key))}
      activeSlot={okno?.typ === "wpis" ? okno : null}
      onSlotAnchor={setKotwicaWpisu}
      onRangeDrag={przeciagnietyZakres}
      onBlockDrag={przeciagnietyBlok}
      // Klik w ten sam slot zamyka dymek, w inny przenosi go
      onSlotClick={(dzien, startMin) => {
        setWybrany(null);
        setOkno((o) =>
          o?.typ === "wpis" && o.date === dzien && o.startMin === startMin
            ? null
            : { typ: "wpis", date: dzien, startMin },
        );
      }}
    />
  );

  return (
    <>
      <CalendarHeader
        view={view}
        date={date}
        today={today}
        weekStart={weekStart}
        // Dziś (w widoku dnia: wybrany dzień) i najbliższa pełna godzina, 60 min; po 23:00 zostaje 23:00
        onNewBlock={() => {
          setWybrany(null);
          setOkno({
            typ: "blok",
            mode: "create",
            initial: {
              title: "",
              categoryId: null,
              date: view === "dzien" ? date : today,
              startMin: Math.min((Math.floor(nowMinutes / 60) + 1) * 60, 23 * 60),
              durationMin: 60,
              recurrence: null,
              note: "",
              remind: true,
            },
          });
        }}
      />
      <div className="flex flex-col gap-3.5 px-6 pt-4 pb-6 max-[799px]:px-4">
        <CategoryFilters
          categories={data.categories}
          counts={liczniki}
          onToggle={przelaczKategorie}
          onAdd={() => setOkno({ typ: "kategoria" })}
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
          tasks={data.tasks}
          category={data.categories.find((k) => k.id === wybraneWystapienie.categoryId)}
          clock={data.profile.clock}
          applyOptimistic={applyOptimistic}
          onEdit={() => {
            const o = wybraneWystapienie;
            setWybrany(null);
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
                // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
                occurrenceDate: o.key.slice(o.blockId.length + 1),
                firstOccurrence: pierwszeWystapienie(o),
              },
            });
          }}
          onDelete={() => {
            const o = wybraneWystapienie;
            setWybrany(null);
            setOkno({ typ: "usun", occurrence: o });
          }}
          onClose={() => setWybrany(null)}
        />
      )}
      {okno?.typ === "wpis" && (
        <NewEntryPopover
          anchor={kotwicaWpisu}
          date={okno.date}
          startMin={okno.startMin}
          clock={data.profile.clock}
          onBlock={() =>
            setOkno({
              typ: "blok",
              mode: "create",
              initial: {
                title: "",
                categoryId: null,
                date: okno.date,
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
          clock={data.profile.clock}
          weekStart={weekStart}
          today={today}
          onCategoryCreated={dodajKategorie}
          onSaved={() => setOkno(null)}
          onCancel={() => setOkno(null)}
        />
      )}
      {okno?.typ === "kategoria" && (
        <CategoryDialog
          usedColors={data.categories.map((k) => k.color)}
          onSaved={(nowa) => {
            dodajKategorie(nowa);
            setOkno(null);
          }}
          onCancel={() => setOkno(null)}
        />
      )}
      {okno?.typ === "przeciagniecie" && (
        <ScopeDialog
          subtitle={[
            `„${okno.occurrence.title}”`,
            okno.occurrence.recurrence ? recurrenceBadge(okno.occurrence.recurrence).slice(2) : null,
            `przesunięcie na ${formatClockTime(Math.floor(okno.wynik.startMin / 60), okno.wynik.startMin % 60, data.profile.clock)}–${formatClockTime(Math.floor((okno.wynik.startMin + okno.wynik.durationMin) / 60), (okno.wynik.startMin + okno.wynik.durationMin) % 60, data.profile.clock)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          date={okno.occurrence.key.slice(okno.occurrence.blockId.length + 1)}
          timeLabel={`${formatClockTime(Math.floor(okno.occurrence.startMin / 60), okno.occurrence.startMin % 60, data.profile.clock)}–${formatClockTime(Math.floor((okno.occurrence.startMin + okno.occurrence.durationMin) / 60), (okno.occurrence.startMin + okno.occurrence.durationMin) % 60, data.profile.clock)}`}
          disableFollowing={
            okno.wynik.date !== okno.occurrence.date && !pierwszeWystapienie(okno.occurrence)
              ? "Zmiana dnia działa dla tego wystąpienia albo dla całej serii."
              : undefined
          }
          onPick={(zakres) => {
            setOkno(null);
            zapiszPrzeciagniecie(okno.occurrence, zakres, okno.wynik);
          }}
          onCancel={() => {
            setOkno(null);
            setPodgladBloku(null);
          }}
        />
      )}
      {okno?.typ === "usun" && (
        <DeleteBlockDialog
          occurrence={okno.occurrence}
          clock={data.profile.clock}
          onDeleted={() => setOkno(null)}
          onCancel={() => setOkno(null)}
        />
      )}
    </>
  );
}
