"use client";

// Okno wpisu snu wg SleepDialog.dc.html; tagi jako chipy i etykiety samopoczucia z MSleep.dc.html.
// Zapis nieoptymistyczny (wzór: BlockDialog): w trakcie zapisu okno jest zablokowane,
// błąd zostaje w oknie, sukces zamyka je, a dane odświeża rewalidacja strony.
import { useRef, useState } from "react";

import {
  Button,
  Chip,
  DatePicker,
  FormDialog,
  MonoLabel,
  TextField,
  TimePicker,
} from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { addDays } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import { saveSleepLog } from "./actions";
import { SLEEP_TAGS } from "./schemas";
import { goalText, nightTitle, sleepMinutes, type SleepLog } from "./sleep";
import { formatDuration } from "./text";

const SAMOPOCZUCIE = ["Źle", "Słabo", "OK", "Dobrze", "Super"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DOMYSLNE_ZASNIECIE = "23:00";
const DOMYSLNA_POBUDKA = "07:00";

export function SleepDialog({
  open,
  onOpenChange,
  date,
  logs,
  goalMin,
  clock,
  weekStart,
  today,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  date: IsoDate;
  // Wszystkie znane wpisy: okno startuje z wpisem z tego dnia (jeśli jest), a po zmianie daty ładuje wpis z nowego dnia
  logs: SleepLog[];
  goalMin: number;
  clock: "24" | "12";
  weekStart: "mon" | "sun";
  today: IsoDate;
}) {
  // Formularz montujemy dopiero przy otwarciu, więc każde otwarcie zaczyna od świeżych wartości
  if (!open) return null;
  return (
    <SleepForm
      onOpenChange={onOpenChange}
      date={date}
      logs={logs}
      goalMin={goalMin}
      clock={clock}
      weekStart={weekStart}
      today={today}
    />
  );
}

function SleepForm({
  onOpenChange,
  date: dataStartowa,
  logs,
  goalMin,
  clock,
  weekStart,
  today,
}: Omit<Parameters<typeof SleepDialog>[0], "open">) {
  const existing = logs.find((l) => l.date === dataStartowa);
  const [date, setDate] = useState(dataStartowa);
  const [sleptAt, setSleptAt] = useState(
    existing?.sleptAt ?? DOMYSLNE_ZASNIECIE,
  );
  const [wokeAt, setWokeAt] = useState(existing?.wokeAt ?? DOMYSLNA_POBUDKA);
  const [feeling, setFeeling] = useState<number | null>(
    existing?.feeling ?? null,
  );
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  // Czy pola pochodzą z zapisanego wpisu (wtedy przejście na pusty dzień czyści je do domyślnych)
  const [zWpisu, setZWpisu] = useState(existing !== undefined);
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie kliknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  // Zmiana daty pobudki: dzień z wpisem ładuje jego wartości, dzień bez wpisu zachowuje to, co wpisał użytkownik
  function zmienDate(nowa: IsoDate | null) {
    if (nowa === null) return;
    setDate(nowa);
    setBlad("");
    const wpis = logs.find((l) => l.date === nowa);
    if (wpis) {
      setSleptAt(wpis.sleptAt);
      setWokeAt(wpis.wokeAt);
      setFeeling(wpis.feeling);
      setTags(wpis.tags);
      setNote(wpis.note ?? "");
      setZWpisu(true);
    } else if (zWpisu) {
      setSleptAt(DOMYSLNE_ZASNIECIE);
      setWokeAt(DOMYSLNA_POBUDKA);
      setFeeling(null);
      setTags([]);
      setNote("");
      setZWpisu(false);
    }
  }

  const minuty = sleepMinutes(sleptAt, wokeAt);
  const mozeZapisac = minuty !== null && !pending;
  const procent =
    minuty !== null && goalMin > 0
      ? Math.min(100, Math.round((minuty / goalMin) * 100))
      : 0;

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

    let wynik: ActionResult;
    try {
      wynik = await saveSleepLog({
        date,
        sleptAt,
        wokeAt,
        feeling: feeling as 1 | 2 | 3 | 4 | 5 | null,
        tags,
        note: note.trim() === "" ? null : note,
      });
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
      onOpenChange={zmienOtwarcie}
      title="Wpis snu"
      description={nightTitle(date).web}
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
            Zapisz
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
          Data pobudki
          <DatePicker
            value={date}
            onChange={zmienDate}
            weekStart={weekStart}
            today={today}
            // Strona wczytuje sen z ostatnich 60 dni; starszy dzień nadpisałby po cichu wpis, którego okno nie widzi
            min={addDays(today, -59)}
            max={today}
            ariaLabel="Data pobudki"
          />
        </div>
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
          Zasnąłem
          <TimePicker
            clock={clock}
            ariaLabel="Zasnąłem"
            value={sleptAt}
            onChange={setSleptAt}
          />
        </div>
        <div className="flex flex-col items-start gap-1.5 text-[13px] font-medium">
          Wstałem
          <TimePicker
            clock={clock}
            ariaLabel="Wstałem"
            value={wokeAt}
            onChange={setWokeAt}
          />
        </div>
      </div>

      {/* Czas snu na żywo */}
      <div className="flex items-center gap-3.5 rounded-lg border border-border bg-panel px-3.5 py-3">
        <div>
          <MonoLabel className="block">Czas snu</MonoLabel>
          <div className="mt-1 font-mono text-[22px]">
            {minuty === null ? "—" : formatDuration(minuty)}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          {minuty === null ? (
            <p role="alert" className="m-0 text-xs text-destructive-foreground">
              Godziny zaśnięcia i pobudki muszą się różnić.
            </p>
          ) : (
            <>
              {goalMin > 0 && (
                <div className="h-1.5 rounded-[3px] bg-border">
                  <div
                    className="h-1.5 rounded-[3px] bg-primary"
                    style={{ width: `${procent}%` }}
                  />
                </div>
              )}
              <div className="mt-1.5 font-mono text-[11px] text-muted-foreground">
                {goalText(minuty, goalMin).web}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Samopoczucie
        <div
          role="radiogroup"
          aria-label="Samopoczucie"
          className="flex gap-1.5 font-normal"
        >
          {SAMOPOCZUCIE.map((etykieta, i) => {
            const wartosc = i + 1;
            const wybrane = feeling === wartosc;
            return (
              <button
                key={etykieta}
                type="button"
                role="radio"
                aria-checked={wybrane}
                // Ponowny klik wybranej wartości czyści samopoczucie
                onClick={() => setFeeling(wybrane ? null : wartosc)}
                className={cn(
                  "flex h-[46px] w-16 cursor-pointer flex-col items-center justify-center rounded-md border text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/20",
                  wybrane
                    ? "border-primary bg-primary text-white"
                    : "border-input bg-white text-foreground hover:bg-panel",
                )}
              >
                <span className="font-mono text-sm">{wartosc}</span>
                <span className={wybrane ? "text-white/80" : "text-muted-foreground"}>
                  {etykieta}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 text-[13px] font-medium">
        Co mogło wpłynąć
        <div className="flex flex-wrap gap-1.5 font-normal">
          {SLEEP_TAGS.map((tag) => (
            <Chip
              key={tag}
              selected={tags.includes(tag)}
              onClick={() =>
                setTags((t) =>
                  t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag],
                )
              }
            >
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <TextField
        label={
          <>
            Notatka{" "}
            <span className="text-xs font-normal text-muted-foreground">
              opcjonalnie
            </span>
          </>
        }
        value={note}
        maxLength={1000}
        placeholder="np. kawa po 18:00"
        onChange={(e) => setNote(e.target.value)}
      />
    </FormDialog>
  );
}
