"use client";

// Klientowy korzeń kalendarza: nagłówek (z filtrami kategorii) i wybrany widok.
// Web: tydzień i dzień to siatka godzin, miesiąc to MonthGrid. Telefon (Task 11): MCalendarDay/Week/Month;
// oba układy są w DOM, przełącza je CSS (800 px). Bez jawnego `widok` w adresie telefon pokazuje dzień.
// Kalendarz wypełnia całe okno (web) i ekran nad dolnym paskiem (dzień na telefonie):
// strona się nie przewija, przewija się tylko siatka albo oś.
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { todayIso, type IsoDate } from "@/components/controls/calendar-math";
import { setCategoryHidden } from "@/features/categories/actions";
import { FormDialog } from "@/components/controls/form-dialog";
import {
  CategoryDialog,
  type NewCategory,
} from "@/features/categories/category-dialog";
import { formatClockTime } from "@/lib/time/timezones";
import { changeOccurrence } from "./actions";
import { BlockDialog, type BlockDialogInitial } from "./block-dialog";
import { BlockDetails, BlockPopover } from "./block-popover";
import { CalendarHeader } from "./calendar-header";
import { DaySide } from "./day-side";
import { DeleteBlockDialog } from "./delete-block-dialog";
import type { DragResult } from "./drag";
import {
  minutesNow,
  type CalendarData,
  type CategoryRow,
} from "./load-calendar";
import { MBlockSheet } from "./mobile/m-block-sheet";
import { MCalendarDay } from "./mobile/m-calendar-day";
import { MCalendarMonth } from "./mobile/m-calendar-month";
import { MCalendarWeek } from "./mobile/m-calendar-week";
import { MonthGrid } from "./month-grid";
import { NewEntryPopover } from "./new-entry-popover";
import { expandOccurrences, type Occurrence } from "./occurrences";
import { recurrenceBadge } from "./recurrence-text";
import { ScopeDialog } from "./scope-dialog";
import {
  planScopeChange,
  ZMIANA_DNIA_NIE_DLA_NASTEPNYCH,
  ZMIANA_DNIA_TYLKO_TYGODNIOWA,
  type BlockPatch,
  type Scope,
} from "./scope";
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
  // `tel`: otwarte na telefonie, więc zamiast BlockDialog pokazuje się arkusz MBlockSheet
  | {
      typ: "blok";
      mode: "create" | "edit";
      initial: BlockDialogInitial;
      tel?: boolean;
    }
  | { typ: "kategoria" }
  | { typ: "usun"; occurrence: Occurrence }
  // Przeciągnięty blok cykliczny czeka na wybór zakresu zmiany
  | { typ: "przeciagniecie"; occurrence: Occurrence; wynik: DragResult };

export function CalendarView({
  view,
  date,
  today: dzisSerwera,
  nowMinutes: terazSerwera,
  data: daneSerwera,
  hasExplicitView = true,
}: {
  view: CalendarView;
  // Czy adres ma `widok`; bez niego web pokazuje domyślny tydzień, a telefon dzień
  hasExplicitView?: boolean;
  date: IsoDate;
  today: IsoDate;
  // Aktualna godzina w strefie profilu, liczona na serwerze; użyją jej widoki z linią „teraz”
  nowMinutes: number;
  data: CalendarData;
}) {
  const router = useRouter();
  const { data, applyOptimistic } = useCalendarStore(daneSerwera);
  const { weekStart } = data.profile;

  // Zegar: start z wartości serwera (bez rozjazdu hydracji), potem co minutę w strefie profilu.
  // Po północy „dziś” przechodzi na nowy dzień. Nowe wartości z serwera zastępują zegar.
  const [zegar, setZegar] = useState({
    today: dzisSerwera,
    nowMinutes: terazSerwera,
  });
  const [zegarDla, setZegarDla] = useState(`${dzisSerwera}|${terazSerwera}`);
  if (zegarDla !== `${dzisSerwera}|${terazSerwera}`) {
    setZegarDla(`${dzisSerwera}|${terazSerwera}`);
    setZegar({ today: dzisSerwera, nowMinutes: terazSerwera });
  }
  const strefa = data.profile.timezone;
  useEffect(() => {
    const id = window.setInterval(() => {
      setZegar({ today: todayIso(strefa), nowMinutes: minutesNow(strefa) });
    }, 60_000);
    return () => window.clearInterval(id);
  }, [strefa]);
  const { today, nowMinutes } = zegar;
  const zakres = useMemo(
    () => viewRange(view, date, weekStart),
    [view, date, weekStart],
  );
  // Widok telefonu; dzień potrzebuje całego tygodnia (pasek z kropkami), więc dane obejmują tydzień
  const widokTel: CalendarView = hasExplicitView ? view : "dzien";
  const zakresTel = useMemo(
    () =>
      viewRange(widokTel === "dzien" ? "tydzien" : widokTel, date, weekStart),
    [widokTel, date, weekStart],
  );

  // Wybrany blok: klucz wystąpienia i element, przy którym otwiera się dymek
  const [wybrany, setWybrany] = useState<string | null>(null);
  // Na telefonie szczegóły bloku otwiera arkusz, nie dymek przy bloku
  const [wybranyTel, setWybranyTel] = useState<string | null>(null);
  // Okno nowego wpisu / bloku / kategorii / usuwania (naraz tylko jedno) i kotwica dymku „Nowy wpis”
  const [okno, setOkno] = useState<Okno | null>(null);
  const [kotwicaWpisu, setKotwicaWpisu] = useState<HTMLElement | null>(null);
  // Miejsce, w którym blok stoi po puszczeniu, zanim zapis się skończy (albo „Anuluj” go cofnie)
  const [podgladBloku, setPodgladBloku] = useState<
    ({ key: string } & DragResult) | null
  >(null);
  // Nowe dane serwera (np. po podziale serii) zastępują podgląd (stan ustawiany w renderze)
  const [daneDla, setDaneDla] = useState(daneSerwera);
  if (daneDla !== daneSerwera) {
    setDaneDla(daneSerwera);
    setPodgladBloku(null);
  }
  // Zmiana widoku albo dnia zamyka dymek (stan ustawiany w renderze, jak w store)
  const [widokDla, setWidokDla] = useState(`${view}|${date}`);
  if (widokDla !== `${view}|${date}`) {
    setWidokDla(`${view}|${date}`);
    setWybrany(null);
    setWybranyTel(null);
    setOkno((o) => (o?.typ === "wpis" ? null : o));
  }

  const wystapienia = useMemo(
    () =>
      expandOccurrences(data.blocks, data.exceptions, zakres.from, zakres.to),
    [data.blocks, data.exceptions, zakres.from, zakres.to],
  );

  // Ten sam zakres co web (np. tydzień z jawnym widokiem): bez drugiego rozwijania bloków
  const tenSamZakres =
    zakresTel.from === zakres.from && zakresTel.to === zakres.to;
  const wystapieniaTelOsobne = useMemo(
    () =>
      tenSamZakres
        ? []
        : expandOccurrences(
            data.blocks,
            data.exceptions,
            zakresTel.from,
            zakresTel.to,
          ),
    [tenSamZakres, data.blocks, data.exceptions, zakresTel.from, zakresTel.to],
  );
  const wystapieniaTel = tenSamZakres ? wystapienia : wystapieniaTelOsobne;

  const ukryte = new Set(
    data.categories.filter((k) => k.hidden).map((k) => k.id),
  );
  const widoczne = wystapienia.filter(
    (o) => !o.categoryId || !ukryte.has(o.categoryId),
  );
  const widoczneTel = wystapieniaTel.filter(
    (o) => !o.categoryId || !ukryte.has(o.categoryId),
  );
  // Podgląd treningów: ukrycie systemowej kategorii „Sport” chowa go; bez tej kategorii jest widoczny
  const kategoriaSport = data.categories.find(
    (k) => k.is_system && k.name === "Sport",
  );
  const treningi = kategoriaSport?.hidden ? [] : data.sport;

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

  // Nowa kategoria od razu trafia do danych, żeby była od razu w menu „Kategorie”. To wiersz zastępczy
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
                  position:
                    Math.max(0, ...d.categories.map((k) => k.position)) + 1,
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
  function zapiszPrzeciagniecie(
    o: Occurrence,
    zakres: Scope,
    wynik: DragResult,
  ) {
    // Oryginalna data wystąpienia siedzi w kluczu (blok mógł zostać przesunięty)
    const dataOryginalna = o.key.slice(o.blockId.length + 1);
    const patch: BlockPatch = {};
    if (wynik.date !== o.date) patch.date = wynik.date;
    if (wynik.startMin !== o.startMin) patch.startMin = wynik.startMin;
    if (wynik.durationMin !== o.durationMin)
      patch.durationMin = wynik.durationMin;

    // Optymistyczna zmiana z tego samego planu, który wykona akcja; podział serii
    // zostaje do odświeżenia danych (do tego czasu blok trzyma podgląd)
    const blok = data.blocks.find((b) => b.id === o.blockId);
    const plan = blok
      ? planScopeChange({ block: blok, occurrence: o, scope: zakres, patch })
      : null;
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
                    p.startMin === undefined
                      ? b.start_local.slice(11, 19)
                      : `${godzina(p.startMin)}:00`
                  }`,
                  duration_min: p.durationMin ?? b.duration_min,
                  // Seria własna przesunięta na inny dzień ma obrócone dni tygodnia
                  recurrence:
                    p.recurrence === undefined ? b.recurrence : p.recurrence,
                },
          ),
        };
      }
      if (plan?.kind === "upsertException") {
        return {
          ...d,
          exceptions: [
            ...d.exceptions.filter(
              (w) =>
                !(
                  w.block_id === plan.row.block_id &&
                  w.occurrence_date === plan.row.occurrence_date
                ),
            ),
            plan.row,
          ],
        };
      }
      return d;
    };

    void applyOptimistic(zmiana, () =>
      changeOccurrence({
        blockId: o.blockId,
        date: dataOryginalna,
        scope: zakres,
        patch,
      }),
    ).then((udane) => {
      // Podział serii nie ma zmiany optymistycznej: podgląd zostaje do nowych danych serwera
      if (!udane || plan?.kind !== "split") setPodgladBloku(null);
    });
  }

  // Puszczony blok: bez zmiany nic się nie dzieje, jednorazowy zapisuje się od razu,
  // cykliczny najpierw pyta o zakres (podgląd zostaje na nowym miejscu)
  function przeciagnietyBlok(o: Occurrence, wynik: DragResult) {
    setWybrany(null);
    if (
      wynik.date === o.date &&
      wynik.startMin === o.startMin &&
      wynik.durationMin === o.durationMin
    )
      return;
    if (!o.recurring) {
      // Otwarty dymek „Nowy wpis” zamyka się razem z ruchem
      setOkno((w) => (w?.typ === "wpis" ? null : w));
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
  const wybraneTel = wybranyTel
    ? widoczneTel.find((o) => o.key === wybranyTel)
    : undefined;
  if (wybranyTel && !wybraneTel) setWybranyTel(null);

  // Edycja i usuwanie bloku: wspólne dla dymku (web) i arkusza (telefon)
  function edytuj(o: Occurrence, tel = false) {
    setWybrany(null);
    setWybranyTel(null);
    setOkno({
      typ: "blok",
      mode: "edit",
      tel,
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
  }

  function usunBlok(o: Occurrence) {
    setWybrany(null);
    setWybranyTel(null);
    setOkno({ typ: "usun", occurrence: o });
  }

  // „+” i stuknięcie pustej osi na telefonie: okno nowego bloku z tym dniem i godziną
  // (arkusz MBlockSheet)
  function dodajNaTelefonie(dzien: IsoDate, startMin: number) {
    setWybranyTel(null);
    setOkno({
      typ: "blok",
      mode: "create",
      tel: true,
      initial: {
        title: "",
        categoryId: null,
        date: dzien,
        startMin,
        // Blok nie przechodzi przez północ
        durationMin: Math.min(60, 1440 - startMin),
        recurrence: null,
        note: "",
        remind: true,
      },
    });
  }

  // Wpisy widoczne w samym miesiącu (siatka obejmuje też dni sąsiednich miesięcy) do nagłówka
  const wpisyMiesiaca =
    widoczne.filter((o) => o.date.slice(0, 7) === date.slice(0, 7)).length +
    treningi.filter((i) => i.date.slice(0, 7) === date.slice(0, 7)).length;
  // Odmiana: 1 wpis widoczny; 2–4, 22–24… wpisy widoczne (ale 12–14 wpisów); reszta wpisów widocznych
  const napisWpisow =
    wpisyMiesiaca === 1
      ? "1 wpis widoczny"
      : wpisyMiesiaca % 10 >= 2 &&
          wpisyMiesiaca % 10 <= 4 &&
          (wpisyMiesiaca % 100 < 12 || wpisyMiesiaca % 100 > 14)
        ? `${wpisyMiesiaca} wpisy widoczne`
        : `${wpisyMiesiaca} wpisów widocznych`;
  // Widok dnia: „N z M bloków” (M liczy też ukryte kategorie)
  const napisBlokow = `${widoczne.filter((o) => o.date === date).length} z ${wystapienia.length} bloków`;
  // Dymki w dwóch dolnych wierszach siatki miesiąca wyrównują się do dołu komórki i rosną w górę
  const wyrownanie = (dzien: IsoDate) =>
    view === "miesiac" && zakres.days.indexOf(dzien) >= 28 ? "end" : "start";

  const siatka = (
    <TimeGrid
      days={zakres.days}
      occurrences={naSiatce}
      sport={treningi}
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
      <div
        className={`flex min-h-0 flex-col min-[800px]:h-dvh ${
          widokTel === "dzien"
            ? "max-[799px]:h-[calc(100dvh-var(--tabbar-h))]"
            : ""
        }`}
      >
        <CalendarHeader
          view={view}
          mobileView={widokTel}
          date={date}
          today={today}
          weekStart={weekStart}
          subtitle={
            view === "miesiac"
              ? napisWpisow
              : view === "dzien"
                ? napisBlokow
                : undefined
          }
          categories={data.categories}
          onToggleCategory={przelaczKategorie}
          onAddCategory={() => setOkno({ typ: "kategoria" })}
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
                startMin: Math.min(
                  (Math.floor(nowMinutes / 60) + 1) * 60,
                  23 * 60,
                ),
                durationMin: 60,
                recurrence: null,
                note: "",
                remind: true,
              },
            });
          }}
        />
        {view === "tydzien" && (
          <div className="flex min-h-0 flex-1 flex-col max-[799px]:hidden">
            {siatka}
          </div>
        )}
        {view === "dzien" && (
          <div className="flex min-h-0 flex-1 max-[799px]:hidden">
            {siatka}
            <DaySide
              date={date}
              today={today}
              weekStart={weekStart}
              occurrences={widoczne.filter((o) => o.date === date)}
              tasks={data.tasks}
              onPick={(dzien) =>
                router.push(`/kalendarz?widok=dzien&data=${dzien}`)
              }
            />
          </div>
        )}
        {view === "miesiac" && (
          <>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6 max-[799px]:hidden">
              <MonthGrid
                days={zakres.days}
                month0={Number(date.slice(5, 7)) - 1}
                occurrences={widoczne}
                sport={treningi}
                categories={data.categories}
                today={today}
                clock={data.profile.clock}
                activeEntryKey={wybrany}
                activeDay={okno?.typ === "wpis" ? okno.date : null}
                // Ponowny klik w ten sam wpis zamyka dymek; wpis zamyka też „Nowy wpis”
                onEntryClick={(key) => {
                  setOkno((o) => (o?.typ === "wpis" ? null : o));
                  setWybrany((w) => (w === key ? null : key));
                }}
                // „+N więcej” przechodzi do dnia, więc otwarte dymki znikają
                onMoreClick={() => {
                  setWybrany(null);
                  setOkno((o) => (o?.typ === "wpis" ? null : o));
                }}
                // Klik w komórkę: „Nowy wpis” z tym dniem i 09:00; ponowny klik zamyka
                onDayClick={(dzien, kotwica) => {
                  setWybrany(null);
                  setKotwicaWpisu(kotwica);
                  setOkno((o) =>
                    o?.typ === "wpis" && o.date === dzien
                      ? null
                      : { typ: "wpis", date: dzien, startMin: 540 },
                  );
                }}
              />
            </div>
          </>
        )}
        {/* Telefon: dzień wypełnia ekran (przewija się oś), tydzień i miesiąc przewijają stronę */}
        <div className="flex min-h-0 flex-1 flex-col min-[800px]:hidden">
          {widokTel === "dzien" && (
            <MCalendarDay
              date={date}
              today={today}
              weekStart={weekStart}
              nowMinutes={nowMinutes}
              occurrences={widoczneTel}
              sport={treningi}
              categories={data.categories}
              clock={data.profile.clock}
              onAdd={dodajNaTelefonie}
              onBlockClick={setWybranyTel}
            />
          )}
          {widokTel === "tydzien" && (
            <div className="px-4">
              <MCalendarWeek
                days={zakresTel.days}
                date={date}
                today={today}
                nowMinutes={nowMinutes}
                occurrences={widoczneTel}
                sport={treningi}
                categories={data.categories}
                clock={data.profile.clock}
                onAdd={dodajNaTelefonie}
                onBlockClick={setWybranyTel}
              />
            </div>
          )}
          {widokTel === "miesiac" && (
            <div className="px-4">
              <MCalendarMonth
                days={zakresTel.days}
                date={date}
                today={today}
                occurrences={widoczneTel}
                sport={treningi}
                categories={data.categories}
                clock={data.profile.clock}
                onAdd={dodajNaTelefonie}
                onBlockClick={setWybranyTel}
              />
            </div>
          )}
        </div>
      </div>
      {wybrany && wybraneWystapienie && (
        <BlockPopover
          occurrence={wybraneWystapienie}
          tasks={data.tasks}
          category={data.categories.find(
            (k) => k.id === wybraneWystapienie.categoryId,
          )}
          clock={data.profile.clock}
          align={wyrownanie(wybraneWystapienie.date)}
          applyOptimistic={applyOptimistic}
          onEdit={() => edytuj(wybraneWystapienie)}
          onDelete={() => usunBlok(wybraneWystapienie)}
          onClose={() => setWybrany(null)}
        />
      )}
      {wybraneTel && (
        // Telefon: szczegóły bloku w dolnym arkuszu (FormDialog), nie w dymku przy bloku
        <FormDialog
          open
          onOpenChange={(otwarte) => !otwarte && setWybranyTel(null)}
          title="Szczegóły bloku"
        >
          <BlockDetails
            occurrence={wybraneTel}
            tasks={data.tasks}
            category={data.categories.find(
              (k) => k.id === wybraneTel.categoryId,
            )}
            clock={data.profile.clock}
            applyOptimistic={applyOptimistic}
            onEdit={() => edytuj(wybraneTel, true)}
            onDelete={() => usunBlok(wybraneTel)}
            onClose={() => setWybranyTel(null)}
          />
        </FormDialog>
      )}
      {okno?.typ === "wpis" && (
        <NewEntryPopover
          anchor={kotwicaWpisu}
          date={okno.date}
          startMin={okno.startMin}
          clock={data.profile.clock}
          align={wyrownanie(okno.date)}
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
      {okno?.typ === "blok" && okno.tel && (
        <MBlockSheet
          key={`${okno.initial.blockId ?? "nowy"}:${okno.initial.occurrenceDate ?? okno.initial.date}`}
          mode={okno.mode}
          initial={okno.initial}
          categories={data.categories}
          clock={data.profile.clock}
          weekStart={weekStart}
          today={today}
          tasks={data.tasks}
          applyOptimistic={applyOptimistic}
          onDone={() => setOkno(null)}
        />
      )}
      {okno?.typ === "blok" && !okno.tel && (
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
            okno.occurrence.recurrence
              ? recurrenceBadge(okno.occurrence.recurrence).slice(2)
              : null,
            `przesunięcie na ${formatClockTime(Math.floor(okno.wynik.startMin / 60), okno.wynik.startMin % 60, data.profile.clock)}–${formatClockTime(Math.floor((okno.wynik.startMin + okno.wynik.durationMin) / 60), (okno.wynik.startMin + okno.wynik.durationMin) % 60, data.profile.clock)}`,
          ]
            .filter(Boolean)
            .join(" · ")}
          date={okno.occurrence.key.slice(okno.occurrence.blockId.length + 1)}
          timeLabel={`${formatClockTime(Math.floor(okno.occurrence.startMin / 60), okno.occurrence.startMin % 60, data.profile.clock)}–${formatClockTime(Math.floor((okno.occurrence.startMin + okno.occurrence.durationMin) / 60), (okno.occurrence.startMin + okno.occurrence.durationMin) % 60, data.profile.clock)}`}
          // Inny dzień: seria codzienna i dni robocze tylko „Tylko to”; inne serie „To i następne”
          // tylko na pierwszym wystąpieniu (zasady jak w planScopeChange)
          disableFollowing={
            okno.wynik.date === okno.occurrence.date
              ? undefined
              : okno.occurrence.recurrence?.freq === "daily" ||
                  okno.occurrence.recurrence?.freq === "weekdays"
                ? ZMIANA_DNIA_TYLKO_TYGODNIOWA
                : !pierwszeWystapienie(okno.occurrence)
                  ? ZMIANA_DNIA_NIE_DLA_NASTEPNYCH
                  : undefined
          }
          disableAll={
            okno.wynik.date !== okno.occurrence.date &&
            (okno.occurrence.recurrence?.freq === "daily" ||
              okno.occurrence.recurrence?.freq === "weekdays")
              ? ZMIANA_DNIA_TYLKO_TYGODNIOWA
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
