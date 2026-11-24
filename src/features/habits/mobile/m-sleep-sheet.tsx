"use client";

// Arkusz wpisu snu na telefonie wg CMSleep.dc.html (FormDialog, nagłówek „actions”: Anuluj / Wpis snu / Zapisz).
// Makieta nie ma wyboru daty: arkusz zapisuje noc dla podanej daty pobudki,
// a gdy ten dzień ma już wpis — edytuje go. Godziny −/+ co 15 min, z przejściem przez północ.
// Zasady zapisu jak w SleepDialog (web, bliźniacza logika w sleep-dialog.tsx): ta sama akcja i ładunek.
// Zapis nieoptymistyczny: w trakcie zapisu Anuluj, Esc i wszystkie pola są zablokowane, błąd zostaje w arkuszu.
import { useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";

import { Button, Card, Chip, FIELD, FormDialog } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { saveSleepLog } from "../actions";
import { SLEEP_TAGS } from "../schemas";
import { goalText, nightTitle, sleepMinutes, type SleepLog } from "../sleep";
import { formatDuration } from "../text";

const SAMOPOCZUCIE = ["Źle", "Słabo", "OK", "Dobrze", "Super"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DOMYSLNE_ZASNIECIE = "23:00";
const DOMYSLNA_POBUDKA = "07:00";
const KROK = 15; // min

export function MSleepSheet({
  date,
  logs,
  goalMin,
  clock,
  onDone,
}: {
  // Data pobudki
  date: IsoDate;
  // Wszystkie znane wpisy: arkusz startuje z wpisem z tego dnia (jeśli jest)
  logs: SleepLog[];
  goalMin: number;
  clock: "24" | "12";
  // Zamknięcie arkusza: po zapisie albo po „Anuluj”
  onDone: () => void;
}) {
  const existing = logs.find((l) => l.date === date);
  const [sleptAt, setSleptAt] = useState(
    existing?.sleptAt ?? DOMYSLNE_ZASNIECIE,
  );
  const [wokeAt, setWokeAt] = useState(existing?.wokeAt ?? DOMYSLNA_POBUDKA);
  const [feeling, setFeeling] = useState<number | null>(
    existing?.feeling ?? null,
  );
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);
  const [note, setNote] = useState(existing?.note ?? "");
  const [pending, setPending] = useState(false);
  const [blad, setBlad] = useState("");
  // Blokada podwójnego zapisu (dwa szybkie stuknięcia, zanim stan pending się odświeży)
  const zapisuje = useRef(false);

  const minuty = sleepMinutes(sleptAt, wokeAt);
  const mozeZapisac = minuty !== null && !pending;

  // 'HH:MM' przesunięte o `o` minut, z zawinięciem przez północ (23:45 + 15 = 00:00)
  function przesun(godzina: string, o: number): string {
    const [g, m] = godzina.split(":").map(Number);
    const nowa = (((g * 60 + m + o) % 1440) + 1440) % 1440;
    return `${String(Math.floor(nowa / 60)).padStart(2, "0")}:${String(nowa % 60).padStart(2, "0")}`;
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
      // Po błędzie odblokowujemy arkusz; po sukcesie zostaje zablokowany aż do zamknięcia
      zapisuje.current = false;
      setPending(false);
      setBlad(wynik.message);
      return;
    }
    onDone();
  }

  // Dwa wiersze godzin: Zasnąłem i Wstałem
  const wiersze = [
    {
      nazwa: "Zasnąłem",
      testId: "zasniecie",
      wartosc: sleptAt,
      zmien: setSleptAt,
      Ikona: Moon,
    },
    {
      nazwa: "Wstałem",
      testId: "pobudka",
      wartosc: wokeAt,
      zmien: setWokeAt,
      Ikona: Sun,
    },
  ];

  return (
    <FormDialog
      open
      // W trakcie zapisu arkusz się nie zamyka (nakładka, Esc)
      onOpenChange={(otwarte) => !otwarte && !pending && onDone()}
      title="Wpis snu"
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
            aria-label="Zapisz wpis snu"
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

      {/* Noc, czas snu na żywo i odniesienie do celu */}
      <div className="text-center">
        <div className="text-xs font-medium text-muted-foreground">
          {nightTitle(date).phone}
        </div>
        <div className="mt-1.5 text-5xl font-semibold tracking-[-0.02em] tabular-nums">
          {minuty === null ? "—" : formatDuration(minuty)}
        </div>
        {minuty === null ? (
          <p
            role="alert"
            className="m-0 text-[13px] text-destructive-foreground"
          >
            Godziny zaśnięcia i pobudki muszą się różnić.
          </p>
        ) : (
          <div className="text-[13px] text-muted-foreground">
            {goalText(minuty, goalMin).phone}
          </div>
        )}
      </div>

      <Card>
        {wiersze.map(({ nazwa, testId, wartosc, zmien, Ikona }) => {
          const [g, m] = wartosc.split(":").map(Number);
          return (
            <div key={nazwa} className="m-row">
              <Ikona
                size={20}
                aria-hidden="true"
                className="flex-none text-soft-foreground"
              />
              <span className="flex-1">{nazwa}</span>
              <span className="m-step">
                <button
                  type="button"
                  aria-label={`${nazwa} wcześniej`}
                  disabled={pending}
                  onClick={() => zmien(przesun(wartosc, -KROK))}
                  className="disabled:cursor-default disabled:opacity-50"
                >
                  −
                </button>
                <span data-testid={testId}>{formatClockTime(g, m, clock)}</span>
                <button
                  type="button"
                  aria-label={`${nazwa} później`}
                  disabled={pending}
                  onClick={() => zmien(przesun(wartosc, KROK))}
                  className="disabled:cursor-default disabled:opacity-50"
                >
                  +
                </button>
              </span>
            </div>
          );
        })}
      </Card>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Jak się wyspałeś?
        </span>
        <div
          role="radiogroup"
          aria-label="Jak się wyspałeś?"
          className="grid grid-cols-5 gap-1.5"
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
                aria-label={`Jakość ${wartosc} — ${etykieta}`}
                disabled={pending}
                // Ponowne stuknięcie wybranej wartości czyści samopoczucie (jak na webie)
                onClick={() => setFeeling(wybrane ? null : wartosc)}
                className={cn(
                  "flex h-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border p-0 outline-none focus-visible:shadow-focus disabled:cursor-default disabled:opacity-50",
                  wybrane
                    ? "border-success/40 bg-success-soft text-success"
                    : "border-input bg-white text-foreground shadow-xs",
                )}
              >
                <span className="text-lg font-semibold tabular-nums">
                  {wartosc}
                </span>
                <span className="text-[11px]">{etykieta}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">
          Co mogło wpłynąć
        </span>
        <div className="flex flex-wrap gap-2">
          {SLEEP_TAGS.map((tag) => (
            <Chip
              key={tag}
              selected={tags.includes(tag)}
              disabled={pending}
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

      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        Notatka
        <textarea
          rows={3}
          value={note}
          maxLength={1000}
          disabled={pending}
          placeholder="Opcjonalnie"
          onChange={(e) => setNote(e.target.value)}
          className={cn(FIELD, "h-auto resize-none py-3 max-[799px]:h-auto")}
        />
      </label>
    </FormDialog>
  );
}
