"use client";

// Arkusz bloku na telefonie wg CMBlockSheet.dc.html (Anuluj / tytuł / Zapisz w nagłówku, FormDialog).
// Jedno okno na tworzenie i edycję. Kroki: formularz -> zakres (edycja bloku cyklicznego, ScopeDialog
// też jest arkuszem poniżej 800 px) albo usuwanie (tryb edycji: „Usuń blok”). Stan formularza zostaje
// w tym komponencie, więc po powrocie z kroku pola są nietknięte. Zapis nie jest optymistyczny: pending + błąd w arkuszu.
// Zasady zapisu jak w BlockDialog (web): te same schematy i akcje; bliźniacza logika zapisu
// i zakresu jest w block-dialog.tsx — zmieniając jedną, popraw drugą.
import { useRef, useState } from "react";
import { BellIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";

import {
  Button,
  Card,
  Chip,
  DatePicker,
  FIELD,
  FormDialog,
  Stepper,
  Switch,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addTask, deleteTask } from "@/features/tasks/actions";
import type { TaskRow } from "@/features/tasks/model";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { changeOccurrence, createBlock } from "../actions";
import type { BlockDialogInitial } from "../block-dialog";
import type { TasksChange } from "../block-popover";
import { DeleteBlockDialog } from "../delete-block-dialog";
import type { CategoryRow } from "../load-calendar";
import type { Occurrence, Recurrence } from "../occurrences";
import { describeRecurrence, recurrenceBadge } from "../recurrence-text";
import { ScopeDialog } from "../scope-dialog";
import {
  ZMIANA_DNIA_NIE_DLA_NASTEPNYCH,
  ZMIANA_DNIA_TYLKO_TYGODNIOWA,
  type BlockPatch,
  type Scope,
} from "../scope";
import { weekdayOf } from "../view-range";
import { DNI_SKROT } from "./pl";

type Powtarzanie = "none" | "daily" | "weekly" | "weekdays" | "custom";

// Kolejność i napisy jak w makiecie CMBlockSheet
const OPCJE_POWTARZANIA: { value: Powtarzanie; label: string }[] = [
  { value: "none", label: "Nie" },
  { value: "daily", label: "Codziennie" },
  { value: "weekly", label: "Co tydzień" },
  { value: "weekdays", label: "Dni robocze" },
  { value: "custom", label: "Własne…" },
];
const PREFIKS_TYMCZASOWY = "tmp-";
const KOLOR_BRAK = "#a3a3a3";

// Arkusz zmienia tylko zadania, więc działa z magazynem kalendarza i Dziś (jak dymek bloku)
type ApplyOptimistic = (
  zmiana: TasksChange,
  akcja: () => Promise<ActionResult>,
) => Promise<boolean>;

export function MBlockSheet({
  mode,
  initial,
  categories,
  clock,
  weekStart,
  today,
  tasks = [],
  applyOptimistic,
  onDone,
}: {
  mode: "create" | "edit";
  initial: BlockDialogInitial;
  categories: CategoryRow[];
  clock: "24" | "12";
  weekStart: "mon" | "sun";
  today: IsoDate;
  // Tylko edycja: wszystkie zadania kalendarza (arkusz wybiera zadania swojego wystąpienia)
  // i zapis z optymistyczną zmianą (jak w szczegółach bloku)
  tasks?: TaskRow[];
  applyOptimistic?: ApplyOptimistic;
  // Zamknięcie arkusza: po zapisie albo po „Anuluj”
  onDone: () => void;
}) {
  const [krok, setKrok] = useState<"formularz" | "zakres" | "usuwanie">(
    "formularz",
  );
  const [title, setTitle] = useState(initial.title);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date);
  const [startMin, setStartMin] = useState(initial.startMin);
  const [endMin, setEndMin] = useState(initial.startMin + initial.durationMin);
  const [note, setNote] = useState(initial.note);
  const [remind, setRemind] = useState(initial.remind);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie stuknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  // Zadania: w tworzeniu lokalna lista tytułów (idą z blokiem), w edycji zadania wystąpienia z kalendarza
  const [nowe, setNowe] = useState<string[]>([]);
  const [szkic, setSzkic] = useState("");
  const licznikTymczasowych = useRef(0);

  // Powtarzanie: wybór, dni „Własnych” i data końca („Powtarzaj do”, opcjonalna jak w BlockDialog)
  const powtarzanie0: Powtarzanie = initial.recurrence?.freq ?? "none";
  const dni0 = initial.recurrence?.byWeekday ?? [weekdayOf(initial.date)];
  const until0 = initial.recurrence?.until ?? null;
  const [until, setUntil] = useState<IsoDate | null>(until0);
  const [rep, setRep] = useState<Powtarzanie>(powtarzanie0);
  const [dni, setDni] = useState<number[]>(dni0);

  const durationMin = endMin - startMin;
  const recurrence: Recurrence | null =
    rep === "none"
      ? null
      : {
          freq: rep,
          ...(rep === "custom"
            ? { byWeekday: [...dni].sort((a, b) => a - b) }
            : {}),
          ...(until ? { until } : {}),
        };

  // Kategorie do wyboru bez systemowych
  const wybor = categories.filter((k) => !k.is_system);

  // Czas trwania na żywo: „1 h 30 min”, „1 h”, „45 min”
  const godzin = Math.floor(durationMin / 60);
  const minut = durationMin % 60;
  const czasTrwania = [
    godzin > 0 ? `${godzin} h` : "",
    minut > 0 ? `${minut} min` : "",
  ]
    .filter(Boolean)
    .join(" ");

  const dataOryginalna = initial.occurrenceDate ?? initial.date;
  const zadaniaWystapienia =
    mode === "edit"
      ? tasks
          .filter(
            (t) =>
              t.block_id === initial.blockId &&
              t.occurrence_date === dataOryginalna,
          )
          .sort((a, b) => a.position - b.position)
      : [];
  // Wiersze zadań: w edycji z id zadania (usuwanie po id), w tworzeniu z indeksem na liście
  const wierszeZadan =
    mode === "edit"
      ? zadaniaWystapienia.map((t) => ({
          klucz: t.id,
          tytul: t.title,
          tymczasowe: t.id.startsWith(PREFIKS_TYMCZASOWY),
        }))
      : nowe.map((tytul, i) => ({
          klucz: `nowe-${i}-${tytul}`,
          tytul,
          tymczasowe: false,
        }));
  // Edycja bez zapisu optymistycznego nie ma jak zapisać zadań, więc pole jest wyłączone
  const zadaniaWylaczone = mode === "edit" && !applyOptimistic;

  const bladPol =
    rep !== "none" && until && until < date
      ? "Koniec powtarzania nie może być przed początkiem."
      : "";
  const mozeZapisac =
    title.trim() !== "" &&
    bladPol === "" &&
    !(rep === "custom" && dni.length === 0) &&
    !pending;

  // Edycja bloku cyklicznego: „tylko to wystąpienie” nie przechowuje kategorii ani powtarzania
  // (notatki i przypomnienia też)
  const cykliczny = initial.recurrence !== null;
  const zmienionePowtarzanie =
    rep !== powtarzanie0 ||
    until !== until0 ||
    (rep === "custom" && [...dni].sort().join() !== [...dni0].sort().join());
  const seriaTylko =
    categoryId !== initial.categoryId ||
    note !== initial.note ||
    remind !== initial.remind ||
    zmienionePowtarzanie;

  function dodajZadanie() {
    const tytul = szkic.trim();
    if (tytul === "" || zadaniaWylaczone) return;
    setSzkic("");
    if (mode === "create") {
      setNowe((n) => [...n, tytul]);
      return;
    }
    // Edycja: zadanie trafia do wystąpienia od razu, bez czekania na „Zapisz”
    const idBloku = initial.blockId;
    if (!idBloku) return;
    licznikTymczasowych.current += 1;
    const tymczasowe: TaskRow = {
      id: `${PREFIKS_TYMCZASOWY}${idBloku}-${licznikTymczasowych.current}`,
      user_id: "",
      title: tytul,
      done: false,
      done_at: null,
      due_date: initial.date,
      block_id: idBloku,
      occurrence_date: dataOryginalna,
      position: Number.MAX_SAFE_INTEGER,
      created_at: null,
    };
    void applyOptimistic!(
      (d) => ({ ...d, tasks: [...d.tasks, tymczasowe] }),
      () =>
        addTask({
          blockId: idBloku,
          date: dataOryginalna,
          title: tytul,
        }),
    );
  }

  function usunZadanie(klucz: string, indeks: number) {
    if (mode === "create") {
      setNowe((n) => n.filter((_, i) => i !== indeks));
      return;
    }
    if (zadaniaWylaczone) return;
    void applyOptimistic!(
      (d) => ({ ...d, tasks: d.tasks.filter((t) => t.id !== klucz) }),
      () => deleteTask({ id: klucz }),
    );
  }

  async function zapiszEdycje(zakres: Scope) {
    // Do akcji idą tylko zmienione pola
    const patch: BlockPatch = {};
    if (title.trim() !== initial.title) patch.title = title.trim();
    if (categoryId !== initial.categoryId) patch.categoryId = categoryId;
    if (note !== initial.note) patch.note = note;
    if (remind !== initial.remind) patch.remind = remind;
    if (date !== initial.date) patch.date = date;
    if (startMin !== initial.startMin) patch.startMin = startMin;
    if (durationMin !== initial.durationMin) patch.durationMin = durationMin;
    if (zmienionePowtarzanie) patch.recurrence = recurrence;

    if (zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = await changeOccurrence({
        blockId: initial.blockId ?? "",
        date: dataOryginalna,
        scope: zakres,
        patch,
      });
    } finally {
      zapisuje.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      setBlad(wynik.message);
      setKrok("formularz");
      return;
    }
    onDone();
  }

  async function zapisz() {
    if (!mozeZapisac) return;
    if (mode === "edit") {
      if (cykliczny) {
        setKrok("zakres");
        return;
      }
      await zapiszEdycje("all");
      return;
    }
    if (zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");
    let wynik: ActionResult;
    try {
      wynik = await createBlock({
        title: title.trim(),
        categoryId,
        date,
        startMin,
        durationMin,
        recurrence,
        note,
        remind,
        // Zadania zapisują się z blokiem, do pierwszego wystąpienia
        tasks: nowe,
      });
    } finally {
      zapisuje.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onDone();
  }

  // Usuwanie bloku: jednorazowy -> ConfirmDialog nad arkuszem, cykliczny -> okno zakresu zamiast arkusza
  const doUsuniecia: Occurrence = {
    key: `${initial.blockId ?? ""}:${dataOryginalna}`,
    blockId: initial.blockId ?? "",
    date: initial.date,
    startMin: initial.startMin,
    durationMin: initial.durationMin,
    title: initial.title,
    categoryId: initial.categoryId,
    note: initial.note,
    remind: initial.remind,
    recurring: initial.recurrence !== null,
    recurrence: initial.recurrence,
    modified: false,
  };
  if (krok === "usuwanie" && initial.recurrence) {
    return (
      <DeleteBlockDialog
        occurrence={doUsuniecia}
        clock={clock}
        onDeleted={onDone}
        onCancel={() => setKrok("formularz")}
      />
    );
  }

  if (krok === "zakres" && initial.recurrence) {
    const przesuniete =
      date !== initial.date ||
      startMin !== initial.startMin ||
      durationMin !== initial.durationMin;
    const godziny = (od: number, doMin: number) =>
      `${formatClockTime(Math.floor(od / 60), od % 60, clock)}–${formatClockTime(Math.floor(doMin / 60), doMin % 60, clock)}`;
    return (
      <ScopeDialog
        subtitle={[
          `„${title.trim()}”`,
          recurrenceBadge(initial.recurrence).slice(2),
          przesuniete ? `przesunięcie na ${godziny(startMin, endMin)}` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        date={dataOryginalna}
        timeLabel={godziny(
          initial.startMin,
          initial.startMin + initial.durationMin,
        )}
        disableThis={
          seriaTylko
            ? "Kategoria, notatka i przypomnienie zmieniają się dla całej serii."
            : undefined
        }
        // Inny dzień: seria codzienna i dni robocze tylko „Tylko to”; inne serie „To i następne”
        // tylko na pierwszym wystąpieniu (zasady jak w planScopeChange)
        disableFollowing={
          date === initial.date
            ? undefined
            : rep === "daily" || rep === "weekdays"
              ? ZMIANA_DNIA_TYLKO_TYGODNIOWA
              : !initial.firstOccurrence
                ? ZMIANA_DNIA_NIE_DLA_NASTEPNYCH
                : undefined
        }
        disableAll={
          date !== initial.date && (rep === "daily" || rep === "weekdays")
            ? ZMIANA_DNIA_TYLKO_TYGODNIOWA
            : undefined
        }
        pending={pending}
        error={blad}
        onPick={zapiszEdycje}
        onCancel={() => setKrok("formularz")}
      />
    );
  }

  const ETYKIETA = "text-xs font-medium text-muted-foreground";
  const PODPOWIEDZ = "text-xs text-muted-foreground tabular-nums";

  return (
    <>
      <FormDialog
        open
        // W trakcie zapisu arkusz się nie zamyka (nakładka, Esc)
        onOpenChange={(otwarte) => !otwarte && !pending && onDone()}
        title={mode === "create" ? "Nowy blok" : "Edytuj blok"}
        phoneHeader="actions"
        phoneCancel={{
          label: "Anuluj",
          onClick: () => {
            if (!pending) onDone();
          },
        }}
        phoneSubmit={
          <Button
            variant="primary"
            aria-label="Zapisz blok"
            disabled={!mozeZapisac}
            onClick={zapisz}
          >
            Zapisz
          </Button>
        }
      >
        {(blad || bladPol) && (
          <div className="flex flex-col items-start gap-1">
            <p role="alert" className="m-0 text-xs text-destructive-foreground">
              {blad || bladPol}
            </p>
            {bladPol && (
              <Button onClick={() => setUntil(null)}>Usuń datę końca</Button>
            )}
          </div>
        )}

        <input
          type="text"
          value={title}
          maxLength={120}
          placeholder="Nazwa bloku"
          aria-label="Nazwa bloku"
          onChange={(e) => setTitle(e.target.value)}
          className={cn(FIELD, "max-[799px]:text-lg max-[799px]:font-medium")}
        />

        <div className="flex flex-col gap-1.5">
          <span className={ETYKIETA}>Kategoria</span>
          <div className="flex flex-wrap gap-2">
            {wybor.map((k) => {
              const kolor = k.color || KOLOR_BRAK;
              const wybrana = categoryId === k.id;
              return (
                <Chip
                  key={k.id}
                  dotColor={kolor}
                  selected={wybrana}
                  // Kolor kategorii to dane: tło, ramka i pierścień wybranej z koloru kategorii
                  style={
                    wybrana
                      ? {
                          background: `${kolor}12`,
                          borderColor: `${kolor}4d`,
                          boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${kolor}66`,
                        }
                      : undefined
                  }
                  // Ponowne stuknięcie zdejmuje wybór (blok bez kategorii)
                  onClick={() =>
                    setCategoryId((c) => (c === k.id ? null : k.id))
                  }
                >
                  {k.name}
                </Chip>
              );
            })}
          </div>
        </div>

        <Card>
          <div className="m-row">
            <span className="flex-1">Dzień</span>
            <DatePicker
              value={date}
              onChange={(d) => d && setDate(d)}
              weekStart={weekStart}
              today={today}
              ariaLabel="Dzień"
            />
          </div>
          <div className="m-row">
            <span className="flex-1">Od</span>
            <Stepper
              ariaLabel="Od"
              value={formatClockTime(
                Math.floor(startMin / 60),
                startMin % 60,
                clock,
              )}
              decDisabled={startMin <= 0}
              incDisabled={startMin >= endMin - 15}
              onDec={() => setStartMin((s) => Math.max(0, s - 15))}
              onInc={() => setStartMin((s) => Math.min(endMin - 15, s + 15))}
            />
          </div>
          <div className="m-row">
            <span className="flex-1">Do</span>
            <Stepper
              ariaLabel="Do"
              value={formatClockTime(
                Math.floor(endMin / 60),
                endMin % 60,
                clock,
              )}
              decDisabled={endMin <= startMin + 15}
              incDisabled={endMin >= 1440}
              onDec={() => setEndMin((k) => Math.max(startMin + 15, k - 15))}
              onInc={() => setEndMin((k) => Math.min(1440, k + 15))}
            />
          </div>
          <div className="m-row min-h-10">
            <span className={PODPOWIEDZ}>Czas trwania: {czasTrwania}</span>
          </div>
        </Card>

        <div className="flex flex-col gap-1.5">
          <span className={ETYKIETA}>Powtarzanie</span>
          <div className="flex flex-wrap gap-2">
            {OPCJE_POWTARZANIA.map((o) => (
              <Chip
                key={o.value}
                selected={rep === o.value}
                onClick={() => setRep(o.value)}
              >
                {o.label}
              </Chip>
            ))}
          </div>
          {rep === "custom" && (
            <div
              role="group"
              aria-label="Dni tygodnia"
              className="mt-1 grid grid-cols-7 gap-1"
            >
              {DNI_SKROT.slice(1).map((nazwa, i) => {
                const numer = i + 1;
                return (
                  <Chip
                    key={nazwa}
                    selected={dni.includes(numer)}
                    className="justify-center px-0"
                    onClick={() =>
                      setDni((d) =>
                        d.includes(numer)
                          ? d.filter((n) => n !== numer)
                          : [...d, numer],
                      )
                    }
                  >
                    {nazwa}
                  </Chip>
                );
              })}
            </div>
          )}
          {rep !== "none" && (
            <Card className="mt-1">
              <div className="m-row">
                <span className="flex-1">Powtarzaj do</span>
                {/* Pusta data = seria bez końca; „Wyczyść” w kalendarzu usuwa koniec */}
                <DatePicker
                  value={until}
                  onChange={setUntil}
                  weekStart={weekStart}
                  today={today}
                  ariaLabel="Powtarzaj do"
                  placeholder="bez końca"
                />
              </div>
            </Card>
          )}
          <span className={PODPOWIEDZ}>
            {describeRecurrence(recurrence, date)}
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className={ETYKIETA}>
            Zadania w bloku · {wierszeZadan.length}
          </span>
          <Card>
            {wierszeZadan.map(({ klucz, tytul, tymczasowe }, i) => (
              <div key={klucz} className="m-row">
                <span
                  aria-hidden="true"
                  className="size-4 flex-none rounded-[4px] border border-input bg-white shadow-xs"
                />
                <span className="min-w-0 flex-1 break-words">{tytul}</span>
                <Button
                  variant="ghost"
                  icon
                  aria-label={`Usuń zadanie ${tytul}`}
                  disabled={tymczasowe}
                  onClick={() => usunZadanie(klucz, i)}
                  className="text-muted-foreground"
                >
                  <XIcon aria-hidden="true" className="size-4" />
                </Button>
              </div>
            ))}
            <div className="m-row gap-2 pr-2">
              <input
                type="text"
                value={szkic}
                maxLength={200}
                placeholder="Dodaj zadanie…"
                aria-label="Nowe zadanie"
                disabled={zadaniaWylaczone}
                onChange={(e) => setSzkic(e.target.value)}
                onKeyDown={(e) => {
                  // Enter dodaje zadanie (nie podczas składania znaków z klawiatury ekranowej)
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    dodajZadanie();
                  }
                }}
                className="h-11 min-w-0 flex-1 border-0 bg-transparent text-base outline-none placeholder:text-faint-foreground"
              />
              <Button
                variant="ghost"
                icon
                aria-label="Dodaj zadanie"
                disabled={zadaniaWylaczone}
                onClick={dodajZadanie}
              >
                <PlusIcon aria-hidden="true" className="size-[18px]" />
              </Button>
            </div>
          </Card>
        </div>

        <label className="flex flex-col gap-1.5 text-[13px] font-medium">
          Notatka
          <textarea
            rows={2}
            value={note}
            maxLength={2000}
            placeholder="Opcjonalnie"
            onChange={(e) => setNote(e.target.value)}
            className={cn(
              FIELD,
              "h-auto resize-y py-2.5 leading-normal max-[799px]:h-auto max-[799px]:px-3",
            )}
          />
        </label>

        <Card>
          <div className="m-row">
            <BellIcon
              aria-hidden="true"
              className="size-[18px] flex-none text-muted-foreground"
            />
            <span className="flex-1">Przypomnij 5 min wcześniej</span>
            <Switch
              checked={remind}
              onChange={setRemind}
              ariaLabel="Przypomnienie"
            />
          </div>
        </Card>

        {mode === "edit" && (
          <Button
            variant="destructive-outline"
            className="w-full"
            disabled={pending}
            onClick={() => setKrok("usuwanie")}
          >
            <Trash2Icon aria-hidden="true" className="size-[18px]" />
            Usuń blok
          </Button>
        )}
      </FormDialog>
      {/* Blok jednorazowy: potwierdzenie „Usunąć blok?” nad arkuszem */}
      {krok === "usuwanie" && !initial.recurrence && (
        <DeleteBlockDialog
          occurrence={doUsuniecia}
          clock={clock}
          onDeleted={onDone}
          onCancel={() => setKrok("formularz")}
        />
      )}
    </>
  );
}
