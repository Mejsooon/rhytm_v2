"use client";

// Arkusz wpisu snu na telefonie wg MSleep.dc.html (pełny ekran, Anuluj / Wpis snu / Zapisz).
// Makieta nie ma wyboru daty: arkusz zapisuje noc dla podanej daty pobudki,
// a gdy ten dzień ma już wpis — edytuje go. Godziny −/+ co 15 min, z przejściem przez północ.
// Zasady zapisu jak w SleepDialog (web, bliźniacza logika w sleep-dialog.tsx): ta sama akcja i ładunek.
// Zapis nieoptymistyczny: w trakcie zapisu Anuluj, Esc i wszystkie pola są zablokowane, błąd zostaje w arkuszu.
import { useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Dialog } from "radix-ui";

import { Chip } from "@/components/controls";
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

const ETYKIETA = "font-mono text-[11px] tracking-[.06em] text-[#6b6b6b] uppercase";
const NAGLOWEK_PRZYCISK =
  "flex h-11 cursor-pointer items-center border-0 bg-transparent px-3 text-[15px] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20";
const PRZYCISK_KROKU =
  "inline-flex size-11 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-[#e0e0e0] bg-white p-0 text-lg text-[#171717] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:cursor-default disabled:opacity-50";

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
  const [sleptAt, setSleptAt] = useState(existing?.sleptAt ?? DOMYSLNE_ZASNIECIE);
  const [wokeAt, setWokeAt] = useState(existing?.wokeAt ?? DOMYSLNA_POBUDKA);
  const [feeling, setFeeling] = useState<number | null>(existing?.feeling ?? null);
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
    { nazwa: "Zasnąłem", testId: "zasniecie", wartosc: sleptAt, zmien: setSleptAt, Ikona: Moon },
    { nazwa: "Wstałem", testId: "pobudka", wartosc: wokeAt, zmien: setWokeAt, Ikona: Sun },
  ];

  return (
    // W trakcie zapisu arkusz się nie zamyka (Esc)
    <Dialog.Root open onOpenChange={(otwarte) => !otwarte && !pending && onDone()}>
      <Dialog.Portal>
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col bg-white text-[15px] text-[#171717] outline-none"
        >
          <div className="flex min-h-[60px] flex-none items-center gap-1 border-b border-[#f0f0f0] p-2">
            <button
              type="button"
              disabled={pending}
              onClick={onDone}
              className={cn(NAGLOWEK_PRZYCISK, "text-[#666666] disabled:cursor-default disabled:opacity-50")}
            >
              Anuluj
            </button>
            <Dialog.Title className="m-0 flex-1 text-center text-[15px] font-semibold">Wpis snu</Dialog.Title>
            <button
              type="button"
              disabled={!mozeZapisac}
              onClick={zapisz}
              className={cn(NAGLOWEK_PRZYCISK, "font-semibold disabled:cursor-default disabled:text-[#a3a3a3]")}
            >
              Zapisz
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 pt-5 pb-6">
            {blad && (
              <p role="alert" className="m-0 text-xs text-[#b91c1c]">
                {blad}
              </p>
            )}

            {/* Noc, czas snu na żywo i odniesienie do celu */}
            <div className="text-center">
              <div className={ETYKIETA}>{nightTitle(date).phone}</div>
              <div className="mt-1.5 font-mono text-5xl font-medium tracking-[-0.02em]">
                {minuty === null ? "—" : formatDuration(minuty)}
              </div>
              {minuty === null ? (
                <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
                  Godziny zaśnięcia i pobudki muszą się różnić.
                </p>
              ) : (
                <div className="text-[13px] text-[#666666]">{goalText(minuty, goalMin).phone}</div>
              )}
            </div>

            <div className="rounded-xl border border-[#eaeaea] bg-white">
              {wiersze.map(({ nazwa, testId, wartosc, zmien, Ikona }) => {
                const [g, m] = wartosc.split(":").map(Number);
                return (
                  <div
                    key={nazwa}
                    className="flex min-h-16 items-center gap-3 border-b border-[#f0f0f0] px-3.5 last:border-b-0"
                  >
                    <Ikona size={20} aria-hidden="true" className="flex-none text-[#666666]" />
                    <span className="flex-1">{nazwa}</span>
                    <button
                      type="button"
                      aria-label={`${nazwa} wcześniej`}
                      disabled={pending}
                      onClick={() => zmien(przesun(wartosc, -KROK))}
                      className={PRZYCISK_KROKU}
                    >
                      −
                    </button>
                    <span data-testid={testId} className="min-w-[60px] text-center font-mono text-lg">
                      {formatClockTime(g, m, clock)}
                    </span>
                    <button
                      type="button"
                      aria-label={`${nazwa} później`}
                      disabled={pending}
                      onClick={() => zmien(przesun(wartosc, KROK))}
                      className={PRZYCISK_KROKU}
                    >
                      +
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <span className={ETYKIETA}>Jak się wyspałeś?</span>
              <div role="radiogroup" aria-label="Jak się wyspałeś?" className="grid grid-cols-5 gap-1.5">
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
                        "flex h-[60px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-xl border outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 disabled:cursor-default disabled:opacity-50",
                        wybrane
                          ? "border-[#15803d] bg-[#f0faf4] text-[#15803d]"
                          : "border-[#e0e0e0] bg-white text-[#404040]",
                      )}
                    >
                      <span className="font-mono text-lg">{wartosc}</span>
                      <span className="text-[10px]">{etykieta}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={ETYKIETA}>Co mogło wpłynąć</span>
              <div className="flex flex-wrap gap-2">
                {SLEEP_TAGS.map((tag) => (
                  <Chip
                    key={tag}
                    selected={tags.includes(tag)}
                    disabled={pending}
                    onClick={() => setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]))}
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
                className="box-border h-[88px] w-full resize-none rounded-[10px] border border-[#e0e0e0] bg-white px-3.5 py-3 text-[15px] font-normal text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717] disabled:opacity-60"
              />
            </label>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
