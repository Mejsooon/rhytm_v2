"use client";

// Okno bloku wg BlockDialog.dc.html (web) i MBlockSheet.dc.html (telefon — arkusz robi FormDialog).
// Jedno okno na tworzenie i edycję. Kroki: formularz -> (zakres, gdy edytujemy blok cykliczny)
// albo (nowa kategoria); stan formularza zostaje w tym komponencie, więc po powrocie
// z innego okna pola są nietknięte. Okna nie zmieniają adresu.
import { useRef, useState } from "react";
import { BellIcon } from "lucide-react";

import {
  Button,
  Chip,
  DatePicker,
  FormDialog,
  Segment,
  Switch,
  TextField,
  TimePicker,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import {
  CategoryDialog,
  type NewCategory,
} from "@/features/categories/category-dialog";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { changeOccurrence, createBlock } from "./actions";
import type { CategoryRow } from "./load-calendar";
import type { Recurrence } from "./occurrences";
import { recurrenceBadge, describeRecurrence } from "./recurrence-text";
import { ScopeDialog } from "./scope-dialog";
import {
  ZMIANA_DNIA_NIE_DLA_NASTEPNYCH,
  ZMIANA_DNIA_TYLKO_TYGODNIOWA,
  type BlockPatch,
  type Scope,
} from "./scope";
import { weekdayOf } from "./view-range";

export type BlockDialogInitial = {
  title: string;
  categoryId: string | null;
  date: IsoDate;
  startMin: number;
  durationMin: number;
  recurrence: Recurrence | null;
  note: string;
  remind: boolean;
  // Tylko edycja: blok i ORYGINALNA data wystąpienia (blok mógł zostać przesunięty)
  blockId?: string;
  occurrenceDate?: IsoDate;
  // Edycja serii: czy to pierwsze wystąpienie (tylko wtedy „To i następne” może zmienić dzień)
  firstOccurrence?: boolean;
};

type Powtarzanie = "none" | "daily" | "weekdays" | "weekly" | "custom";

const OPCJE_POWTARZANIA: { value: Powtarzanie; label: string }[] = [
  { value: "none", label: "Nie powtarzaj" },
  { value: "daily", label: "Codziennie" },
  { value: "weekdays", label: "Dni robocze" },
  { value: "weekly", label: "Co tydzień" },
  { value: "custom", label: "Własne…" },
];
const DNI = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];

function naGodzine(minuty: number): string {
  return `${String(Math.floor(minuty / 60)).padStart(2, "0")}:${String(minuty % 60).padStart(2, "0")}`;
}
function zGodziny(wartosc: string): number {
  const [h, m] = wartosc.split(":").map(Number);
  return h * 60 + m;
}

export function BlockDialog({
  mode,
  initial,
  categories,
  clock,
  weekStart,
  today,
  onCategoryCreated,
  onSaved,
  onCancel,
}: {
  mode: "create" | "edit";
  initial: BlockDialogInitial;
  categories: CategoryRow[];
  clock: "24" | "12";
  weekStart: "mon" | "sun";
  today: IsoDate;
  // Nowa kategoria z okna „+ Nowa” — rodzic dopisuje ją do danych kalendarza
  onCategoryCreated?: (category: NewCategory) => void;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [krok, setKrok] = useState<"formularz" | "zakres" | "kategoria">(
    "formularz",
  );
  const [title, setTitle] = useState(initial.title);
  const [categoryId, setCategoryId] = useState(initial.categoryId);
  const [date, setDate] = useState(initial.date);
  const [startMin, setStartMin] = useState(initial.startMin);
  const [endMin, setEndMin] = useState(initial.startMin + initial.durationMin);
  const [note, setNote] = useState(initial.note);
  const [remind, setRemind] = useState(initial.remind);
  const [dodane, setDodane] = useState<NewCategory[]>([]);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie kliknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  // Powtarzanie: wybór, dni własnego powtarzania i data końca
  const powtarzanie0: Powtarzanie = initial.recurrence?.freq ?? "none";
  const dni0 = initial.recurrence?.byWeekday ?? [weekdayOf(initial.date)];
  const until0 = initial.recurrence?.until ?? null;
  const [rep, setRep] = useState<Powtarzanie>(powtarzanie0);
  const [dni, setDni] = useState<number[]>(dni0);
  const [until, setUntil] = useState<IsoDate | null>(until0);

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

  // Kategorie do wyboru: bez systemowych, plus dopiero co dodane
  const wybor = [
    ...categories
      .filter((k) => !k.is_system)
      .map((k) => ({ id: k.id, name: k.name, color: k.color })),
    ...dodane.filter((d) => !categories.some((k) => k.id === d.id)),
  ];

  let bladPol = "";
  if (durationMin < 15)
    bladPol = "Koniec musi być co najmniej 15 minut po początku.";
  else if (until && until < date)
    bladPol = "Koniec powtarzania nie może być przed początkiem.";
  const mozeZapisac =
    title.trim() !== "" &&
    bladPol === "" &&
    !(rep === "custom" && dni.length === 0) &&
    !pending;

  // Edycja bloku cyklicznego: które pola zmieniono (wyjątek „tylko to wystąpienie” nie przechowuje
  // kategorii, notatki, przypomnienia ani powtarzania)
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
        date: initial.occurrenceDate ?? initial.date,
        scope: zakres,
        patch,
      });
    } finally {
      zapisuje.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      // Błąd (np. powtarzanie bez tego dnia) pokazujemy w formularzu, żeby można było poprawić
      setBlad(wynik.message);
      setKrok("formularz");
      return;
    }
    onSaved();
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
      });
    } finally {
      zapisuje.current = false;
      setPending(false);
    }
    if (!wynik.ok) {
      setBlad(wynik.message);
      return;
    }
    onSaved();
  }

  if (krok === "kategoria") {
    return (
      <CategoryDialog
        usedColors={wybor.map((k) => k.color)}
        onSaved={(nowa) => {
          setDodane((d) => [...d, nowa]);
          setCategoryId(nowa.id);
          setKrok("formularz");
          onCategoryCreated?.(nowa);
        }}
        onCancel={() => setKrok("formularz")}
      />
    );
  }

  if (krok === "zakres" && initial.recurrence) {
    const przesuniete =
      date !== initial.date ||
      startMin !== initial.startMin ||
      durationMin !== initial.durationMin;
    return (
      <ScopeDialog
        subtitle={[
          `„${title.trim()}”`,
          recurrenceBadge(initial.recurrence).slice(2),
          przesuniete
            ? `przesunięcie na ${formatClockTime(Math.floor(startMin / 60), startMin % 60, clock)}–${formatClockTime(Math.floor(endMin / 60), endMin % 60, clock)}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
        date={initial.occurrenceDate ?? initial.date}
        timeLabel={`${formatClockTime(Math.floor(initial.startMin / 60), initial.startMin % 60, clock)}–${formatClockTime(Math.floor((initial.startMin + initial.durationMin) / 60), (initial.startMin + initial.durationMin) % 60, clock)}`}
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

  return (
    <FormDialog
      open
      wide
      onOpenChange={(otwarte) => !otwarte && onCancel()}
      title={mode === "create" ? "Nowy blok" : "Edytuj blok"}
      description={
        mode === "create"
          ? "Zadania dodasz po zapisaniu, w dymku bloku."
          : undefined
      }
      footer={
        <>
          {blad && (
            <p role="alert" className="mr-auto text-xs text-destructive-foreground">
              {blad}
            </p>
          )}
          <Button onClick={onCancel}>Anuluj</Button>
          <Button variant="primary" disabled={!mozeZapisac} onClick={zapisz}>
            Zapisz blok
          </Button>
        </>
      }
    >
      <TextField
        label="Tytuł"
        value={title}
        maxLength={120}
        autoFocus
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Kategoria
        <div className="flex flex-wrap gap-1.5 font-normal">
          {wybor.map((k) => (
            <Chip
              key={k.id}
              dotColor={k.color}
              selected={categoryId === k.id}
              // Ponowny klik zdejmuje wybór (blok bez kategorii)
              onClick={() => setCategoryId((c) => (c === k.id ? null : k.id))}
            >
              {k.name}
            </Chip>
          ))}
          <Chip dashed onClick={() => setKrok("kategoria")}>
            + Nowa
          </Chip>
        </div>
      </div>

      <div className="grid grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))] gap-3 max-[799px]:grid-cols-2">
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium max-[799px]:col-span-2">
          Dzień
          <DatePicker
            value={date}
            onChange={(d) => d && setDate(d)}
            weekStart={weekStart}
            today={today}
            ariaLabel="Dzień"
          />
        </div>
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
          Od
          <TimePicker
            clock={clock}
            ariaLabel="Od"
            value={naGodzine(startMin)}
            onChange={(v) => {
              // Zmiana „od” przesuwa „do”, zachowując czas trwania
              const nowyStart = zGodziny(v);
              setStartMin(nowyStart);
              setEndMin(Math.min(nowyStart + durationMin, 1440));
            }}
          />
        </div>
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
          Do
          <TimePicker
            clock={clock}
            ariaLabel="Do"
            allowEndOfDay
            value={naGodzine(endMin)}
            onChange={(v) => setEndMin(zGodziny(v))}
          />
        </div>
      </div>
      {bladPol && (
        <p role="alert" className="m-0 -mt-1.5 text-xs text-destructive-foreground">
          {bladPol}
        </p>
      )}

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Powtarzanie
        <Segment
          ariaLabel="Powtarzanie"
          value={rep}
          onChange={setRep}
          options={OPCJE_POWTARZANIA}
        />
        {(rep === "weekly" || rep === "custom") && (
          <div className="flex flex-wrap items-center gap-1.5 font-normal">
            {DNI.map((nazwa, i) => {
              const numer = i + 1;
              // Co tydzień: dzień wynika z daty (tylko podgląd); własne: dni do wyboru
              const wybrany =
                rep === "weekly"
                  ? weekdayOf(date) === numer
                  : dni.includes(numer);
              return (
                <button
                  key={nazwa}
                  type="button"
                  aria-pressed={wybrany}
                  disabled={rep === "weekly"}
                  onClick={() =>
                    setDni((d) =>
                      d.includes(numer)
                        ? d.filter((n) => n !== numer)
                        : [...d, numer],
                    )
                  }
                  className={cn(
                    "size-[34px] cursor-pointer rounded-md border text-xs outline-none focus-visible:shadow-focus disabled:cursor-default max-[799px]:size-11",
                    wybrany
                      ? "border-primary bg-primary text-white"
                      : "border-input bg-white text-soft-foreground",
                  )}
                >
                  {nazwa}
                </button>
              );
            })}
          </div>
        )}
        {rep !== "none" && (
          <div className="flex items-center gap-2 font-normal">
            <span className="text-xs text-muted-foreground">do</span>
            <DatePicker
              value={until}
              onChange={setUntil}
              weekStart={weekStart}
              today={today}
              ariaLabel="Powtarzaj do"
              placeholder="bez końca"
            />
          </div>
        )}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {describeRecurrence(recurrence, date)}
        </span>
      </div>

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          Notatka{" "}
          <span className="text-xs font-normal text-muted-foreground">
            opcjonalnie
          </span>
        </span>
        <textarea
          rows={2}
          value={note}
          maxLength={2000}
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-y rounded-md border border-input bg-white px-2.5 py-2 text-sm font-normal text-foreground outline-none focus:border-primary"
        />
      </label>

      <div className="flex items-center gap-2.5 text-[13px] max-[799px]:min-h-11">
        <BellIcon
          aria-hidden="true"
          className="size-[18px] flex-none text-muted-foreground"
        />
        <span className="flex-1">Przypomnij 10 min wcześniej</span>
        <Switch
          checked={remind}
          onChange={setRemind}
          ariaLabel="Przypomnienie"
        />
      </div>
    </FormDialog>
  );
}
