"use client";

// Okno nowego i edytowanego nawyku wg HabitDialog.dc.html.
// Zapis nieoptymistyczny (wzór: BlockDialog): w trakcie zapisu okno jest zablokowane,
// błąd zostaje w oknie, sukces zamyka je, a dane odświeża rewalidacja strony.
import { useRef, useState } from "react";

import {
  Button,
  FormDialog,
  Segment,
  Stepper,
  Switch,
  TextField,
  TimePicker,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { createHabit, updateHabit } from "./actions";
import { scheduleOn, type Habit, type ScheduleType } from "./model";
import { describeSchedule } from "./text";

const TRYBY: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Codziennie" },
  { value: "weekdays", label: "Wybrane dni" },
  { value: "times_per_week", label: "X razy w tygodniu" },
];

// Numer dnia (1 = pn … 7 = nd) → skrót i pełna nazwa (do aria-label)
const SKROTY = ["pn", "wt", "śr", "cz", "pt", "sb", "nd"];
const PELNE = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function HabitDialog({
  open,
  onOpenChange,
  habit,
  weekStart,
  clock,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Podany nawyk = tryb edycji
  habit?: Habit;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  today: IsoDate;
}) {
  // Formularz montujemy dopiero przy otwarciu, więc każde otwarcie zaczyna od świeżych wartości
  if (!open) return null;
  return (
    <HabitForm
      onOpenChange={onOpenChange}
      habit={habit}
      weekStart={weekStart}
      clock={clock}
      today={today}
    />
  );
}

function HabitForm({
  onOpenChange,
  habit,
  weekStart,
  clock,
  today,
}: {
  onOpenChange: (open: boolean) => void;
  habit?: Habit;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  today: IsoDate;
}) {
  // Edycja: wartości z wersji obowiązującej dziś (gdy wszystkie są z przyszłości — pierwsza)
  const wersja = habit
    ? (scheduleOn(habit, today) ?? habit.schedules[0] ?? null)
    : null;

  const [name, setName] = useState(habit?.name ?? "");
  const [tryb, setTryb] = useState<ScheduleType>(wersja?.type ?? "daily");
  const [dni, setDni] = useState<number[]>(
    wersja?.type === "weekdays" ? wersja.weekdays : [],
  );
  const [razy, setRazy] = useState(wersja?.timesPerWeek ?? 3);
  const [przypomnienie, setPrzypomnienie] = useState(
    habit ? habit.remindAt !== null : false,
  );
  const [godzina, setGodzina] = useState(habit?.remindAt ?? "20:30");
  const [naDzis, setNaDzis] = useState(habit?.showOnToday ?? true);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie kliknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  // Przyciski dni od pierwszego dnia tygodnia z profilu
  const kolejnosc =
    weekStart === "mon" ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6];

  const nazwa = name.trim();
  const mozeZapisac =
    nazwa !== "" && !(tryb === "weekdays" && dni.length === 0) && !pending;

  // Zdanie pod harmonogramem (teksty z makiety)
  let podsumowanie = "Codziennie. Seria liczona w dniach.";
  if (tryb === "weekdays") {
    if (dni.length === 0) podsumowanie = "Wybierz przynajmniej jeden dzień.";
    else if (dni.length === 7)
      podsumowanie = "Wszystkie dni — to to samo co „Codziennie”.";
    else
      podsumowanie = `${describeSchedule({ validFrom: today, type: "weekdays", weekdays: dni, timesPerWeek: null })}. Pozostałe dni nie psują serii.`;
  } else if (tryb === "times_per_week") {
    podsumowanie = `${razy}× w tygodniu, dowolne dni. Seria liczona w tygodniach.`;
  }

  let podpisPrzypomnienia = "przypomnienia wyłączone";
  if (przypomnienie) {
    if (tryb === "weekdays") podpisPrzypomnienia = "tylko w dni z harmonogramu";
    else if (tryb === "daily") podpisPrzypomnienia = "codziennie";
    else podpisPrzypomnienia = "w dni bez odhaczenia";
  }

  // Zamknięcie (Esc, tło, ✕) jest blokowane na czas zapisu
  function zmienOtwarcie(otwarte: boolean) {
    if (!otwarte && pending) return;
    onOpenChange(otwarte);
  }

  async function zapisz() {
    if (!mozeZapisac || zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");

    const dane = {
      name: nazwa,
      schedule: {
        type: tryb,
        weekdays: tryb === "weekdays" ? [...dni].sort((a, b) => a - b) : [],
        timesPerWeek: tryb === "times_per_week" ? razy : null,
      },
      remindAt: przypomnienie ? godzina : null,
      showOnToday: naDzis,
    };

    let wynik: ActionResult;
    try {
      wynik = habit
        ? await updateHabit(habit.id, dane)
        : await createHabit(dane);
    } catch {
      wynik = { ok: false, message: BLAD_ZAPISU };
    }
    if (!wynik.ok) {
      // Po błędzie odblokowujemy okno; po sukcesie zostaje zablokowane aż do zamknięcia (bez mignięcia przycisków)
      zapisuje.current = false;
      setPending(false);
      setBlad(wynik.message);
      return;
    }
    onOpenChange(false);
  }

  return (
    <FormDialog
      open
      wide
      onOpenChange={zmienOtwarcie}
      title={habit ? "Edytuj nawyk" : "Nowy nawyk"}
      footer={
        <>
          {blad && (
            <p role="alert" className="mr-auto text-xs text-destructive-foreground">
              {blad}
            </p>
          )}
          <Button disabled={pending} onClick={() => onOpenChange(false)}>
            Anuluj
          </Button>
          <Button variant="primary" disabled={!mozeZapisac} onClick={zapisz}>
            {habit ? "Zapisz" : "Dodaj nawyk"}
          </Button>
        </>
      }
    >
      <TextField
        label="Nazwa"
        value={name}
        maxLength={80}
        autoFocus
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Harmonogram
        <Segment
          ariaLabel="Harmonogram"
          value={tryb}
          onChange={setTryb}
          options={TRYBY}
        />
        {tryb === "weekdays" && (
          <div className="flex gap-1.5 font-normal">
            {kolejnosc.map((numer) => {
              const wybrany = dni.includes(numer);
              return (
                <button
                  key={numer}
                  type="button"
                  aria-pressed={wybrany}
                  aria-label={PELNE[numer - 1]}
                  onClick={() =>
                    setDni((d) =>
                      d.includes(numer)
                        ? d.filter((n) => n !== numer)
                        : [...d, numer],
                    )
                  }
                  className={cn(
                    "size-[38px] cursor-pointer rounded-md border text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
                    wybrany
                      ? "border-primary bg-primary text-white"
                      : "border-input bg-white text-soft-foreground",
                  )}
                >
                  {SKROTY[numer - 1]}
                </button>
              );
            })}
          </div>
        )}
        {tryb === "times_per_week" && (
          <div className="flex items-center gap-2 font-normal">
            <Stepper
              ariaLabel="razy w tygodniu"
              value={String(razy)}
              decDisabled={razy <= 1}
              incDisabled={razy >= 7}
              onDec={() => setRazy((n) => Math.max(1, n - 1))}
              onInc={() => setRazy((n) => Math.min(7, n + 1))}
            />
            <span className="text-xs text-muted-foreground">razy w tygodniu</span>
          </div>
        )}
        <span className="font-mono text-xs font-normal text-muted-foreground">
          {podsumowanie}
        </span>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Przypomnienie
        <div className="flex flex-wrap items-center gap-2.5 font-normal">
          <Switch
            checked={przypomnienie}
            onChange={setPrzypomnienie}
            ariaLabel="Przypomnienie push"
          />
          <span className={przypomnienie ? "" : "text-faint-foreground"}>Push o</span>
          <TimePicker
            clock={clock}
            ariaLabel="Godzina przypomnienia"
            value={godzina}
            onChange={setGodzina}
            disabled={!przypomnienie}
          />
          <span className="text-xs text-muted-foreground">{podpisPrzypomnienia}</span>
        </div>
      </div>

      {/* Makieta nie ma tego pola — dodane pod przypomnieniem w tym samym stylu */}
      <div className="flex items-center gap-2.5 text-[13px]">
        <Switch
          checked={naDzis}
          onChange={setNaDzis}
          ariaLabel="Pokazuj na ekranie Dziś"
        />
        <span>Pokazuj na ekranie Dziś</span>
      </div>
    </FormDialog>
  );
}
