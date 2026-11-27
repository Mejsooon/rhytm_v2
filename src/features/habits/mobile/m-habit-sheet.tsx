"use client";

// Arkusz nowego i edytowanego nawyku na telefonie wg CMHabitNew.dc.html (FormDialog, nagłówek „actions”: Anuluj / tytuł / Zapisz).
// Zasady zapisu jak w HabitDialog (web): ten sam ładunek i te same akcje; bliźniacza logika
// jest w habit-dialog.tsx — zmieniając jedną, popraw drugą.
// Zapis nieoptymistyczny: w trakcie zapisu Anuluj i Esc są zablokowane, błąd zostaje w arkuszu.
import { useRef, useState } from "react";

import {
  Button,
  Card,
  Chip,
  FormDialog,
  Segment,
  Stepper,
  Switch,
  TextField,
  TimePicker,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { createHabit, updateHabit } from "../actions";
import { activeVersion, type Habit, type ScheduleType } from "../model";

const TRYBY: { value: ScheduleType; label: string }[] = [
  { value: "daily", label: "Codziennie" },
  { value: "weekdays", label: "Wybrane dni" },
  { value: "times_per_week", label: "X w tyg." },
];

// Numer dnia (1 = pn … 7 = nd) → skrót z makiety i pełna nazwa (do aria-label)
const SKROTY = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"];
const PELNE = [
  "poniedziałek",
  "wtorek",
  "środa",
  "czwartek",
  "piątek",
  "sobota",
  "niedziela",
];
// Godziny przypomnienia z makiety
const GODZINY = ["07:30", "12:00", "18:00", "21:00"];

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function MHabitSheet({
  habit,
  weekStart,
  clock,
  today,
  onDone,
}: {
  // Podany nawyk = tryb edycji
  habit?: Habit;
  weekStart: "mon" | "sun";
  clock: "24" | "12";
  today: IsoDate;
  // Zamknięcie arkusza: po zapisie albo po „Anuluj”
  onDone: () => void;
}) {
  // Edycja: wartości z wersji obowiązującej dziś (gdy wszystkie są z przyszłości — pierwsza)
  const wersja = habit
    ? (activeVersion(habit, today) ?? habit.schedules[0] ?? null)
    : null;

  const [name, setName] = useState(habit?.name ?? "");
  const [tryb, setTryb] = useState<ScheduleType>(wersja?.type ?? "daily");
  const [dni, setDni] = useState<number[]>(
    wersja?.type === "weekdays" ? wersja.weekdays : [],
  );
  const [razy, setRazy] = useState(wersja?.timesPerWeek ?? 3);
  // Nowy nawyk: przypomnienie wyłączone jak na webie; po włączeniu pierwsza godzina z makiety
  const [przypomnienie, setPrzypomnienie] = useState(
    habit ? habit.remindAt !== null : false,
  );
  const [godzina, setGodzina] = useState(habit?.remindAt ?? GODZINY[0]);
  // „Inna…”: własna godzina z TimePickera (także gdy zapisana godzina nie jest żadnym chipem)
  const [inna, setInna] = useState(
    !GODZINY.includes(habit?.remindAt ?? GODZINY[0]),
  );
  const [naDzis, setNaDzis] = useState(habit?.showOnToday ?? true);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie stuknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  // Przyciski dni od pierwszego dnia tygodnia z profilu
  const kolejnosc =
    weekStart === "mon" ? [1, 2, 3, 4, 5, 6, 7] : [7, 1, 2, 3, 4, 5, 6];

  const nazwa = name.trim();
  const mozeZapisac =
    nazwa !== "" && !(tryb === "weekdays" && dni.length === 0) && !pending;

  const [g, m] = godzina.split(":").map(Number);
  const godzinaTekst = formatClockTime(g, m, clock);

  // Zdanie podsumowania jak w makiecie: „Nawyk: Pn, Śr, Pt, przypomnienie o 07:30.”
  let kiedy = "codziennie";
  if (tryb === "times_per_week") kiedy = `${razy}× w tygodniu`;
  if (tryb === "weekdays") {
    kiedy =
      dni.length === 0
        ? "brak dni"
        : [...dni]
            .sort((a, b) => a - b)
            .map((d) => SKROTY[d - 1])
            .join(", ");
  }
  const podsumowanie = `Nawyk: ${kiedy}${przypomnienie ? `, przypomnienie o ${godzinaTekst}` : ", bez przypomnienia"}.`;

  async function zapisz() {
    if (!mozeZapisac || zapisuje.current) return;
    zapisuje.current = true;
    setPending(true);
    setBlad("");

    // Ładunek jak w HabitDialog
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
      // Po błędzie odblokowujemy arkusz; po sukcesie zostaje zablokowany aż do zamknięcia
      zapisuje.current = false;
      setPending(false);
      setBlad(wynik.message);
      return;
    }
    onDone();
  }

  return (
    <FormDialog
      open
      // W trakcie zapisu arkusz się nie zamyka (nakładka, Esc)
      onOpenChange={(otwarte) => !otwarte && !pending && onDone()}
      title={habit ? "Edytuj nawyk" : "Nowy nawyk"}
      phoneHeader="actions"
      phoneCancel={{ label: "Anuluj", onClick: onDone, disabled: pending }}
      phoneSubmit={
        <Button variant="primary" disabled={!mozeZapisac} onClick={zapisz}>
          Zapisz
        </Button>
      }
      // Od 800 px (obrót tabletu przy otwartym arkuszu) okno ma zwykłą stopkę; na telefonie jest ukryta
      footer={
        <>
          <Button
            aria-label="Anuluj i zamknij"
            disabled={pending}
            onClick={onDone}
          >
            Anuluj
          </Button>
          <Button
            variant="primary"
            aria-label="Zapisz nawyk"
            disabled={!mozeZapisac}
            onClick={zapisz}
          >
            Zapisz
          </Button>
        </>
      }
    >
      {blad && (
        <p role="alert" className="m-0 text-xs text-destructive-foreground">
          {blad}
        </p>
      )}

      <TextField
        label="Nazwa"
        type="text"
        value={name}
        maxLength={80}
        placeholder="Np. Woda 2 l"
        onChange={(e) => setName(e.target.value)}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Jak często
        </span>
        <Segment
          ariaLabel="Jak często"
          value={tryb}
          onChange={setTryb}
          options={TRYBY}
        />
      </div>

      {tryb === "weekdays" && (
        <div
          role="group"
          aria-label="Dni tygodnia"
          className="grid grid-cols-7 gap-1.5"
        >
          {kolejnosc.map((numer) => (
            <Chip
              key={numer}
              selected={dni.includes(numer)}
              ariaLabel={PELNE[numer - 1]}
              className="justify-center px-0"
              onClick={() =>
                setDni((d) =>
                  d.includes(numer)
                    ? d.filter((n) => n !== numer)
                    : [...d, numer],
                )
              }
            >
              {SKROTY[numer - 1]}
            </Chip>
          ))}
        </div>
      )}

      {tryb === "times_per_week" && (
        <Card>
          <div className="m-row">
            <span className="flex-1">Razy w tygodniu</span>
            <Stepper
              ariaLabel="Razy w tygodniu"
              value={String(razy)}
              decDisabled={razy <= 1}
              incDisabled={razy >= 7}
              onDec={() => setRazy((n) => Math.max(1, n - 1))}
              onInc={() => setRazy((n) => Math.min(7, n + 1))}
            />
          </div>
        </Card>
      )}

      <Card>
        <div className="m-row">
          <span className="flex-1">Przypomnienie</span>
          <Switch
            checked={przypomnienie}
            onChange={setPrzypomnienie}
            ariaLabel="Przypomnienie"
          />
        </div>
        {przypomnienie && (
          <div className="m-row flex-wrap gap-2 py-2.5">
            {GODZINY.map((t) => (
              <Chip
                key={t}
                selected={!inna && godzina === t}
                className="tabular-nums"
                onClick={() => {
                  setGodzina(t);
                  setInna(false);
                }}
              >
                {formatClockTime(
                  Number(t.slice(0, 2)),
                  Number(t.slice(3)),
                  clock,
                )}
              </Chip>
            ))}
            <Chip selected={inna} onClick={() => setInna(true)}>
              Inna…
            </Chip>
            {inna && (
              <TimePicker
                clock={clock}
                ariaLabel="Godzina przypomnienia"
                value={godzina}
                onChange={setGodzina}
              />
            )}
          </div>
        )}
        <div className="m-row">
          <span className="flex-1">Pokazuj na ekranie Dziś</span>
          <Switch
            checked={naDzis}
            onChange={setNaDzis}
            ariaLabel="Pokazuj na ekranie Dziś"
          />
        </div>
      </Card>

      <p className="m-0 text-[13px] leading-normal text-muted-foreground">
        {podsumowanie}
      </p>
    </FormDialog>
  );
}
