"use client";

// Edytor szablonu treningu (WorkoutTemplates.dc.html, widok edycji): ścieżka „Sport / Szablony treningów /
// Nowy szablon | Edycja: X”, nazwa, chipy dni pn–nd z godziną startu (tylko przy wybranych dniach),
// tabela ćwiczeń (serie −/+, powt., przerwa „m:ss”, ↑ ↓ ✕), „+ Ćwiczenie”, Zapisz / Anuluj / Usuń.
// Okno czeka na serwer: przyciski są zablokowane w trakcie, a błąd zostaje na ekranie.
// Jedno drzewo dla webu i telefonu — tabela przewija się poziomo w wąskim oknie.
import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Button, Chip, TimePicker } from "@/components/controls";
import { cn } from "@/lib/utils";
import { deleteTemplate, saveTemplate } from "./actions";
import { ExercisePicker } from "./exercise-picker";
import type { SportProfile, TemplateWithItems } from "./load-sport";
import { formatRest, parseRest, plPlural, type ExerciseRow } from "./model";

export type TemplateEditorData = {
  profile: SportProfile;
  exercises: ExerciseRow[];
  template: TemplateWithItems | null; // null = nowy szablon
};

type Wiersz = {
  key: string;
  name: string;
  sets: number;
  reps: string;
  rest: string; // "m:ss" wpisywane ręcznie
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const DNI = ["Pn", "Wt", "Śr", "Cz", "Pt", "Sb", "Nd"]; // indeks + 1 = dzień w weekdays
const DOMYSLNA_GODZINA = "17:00";
const SIATKA =
  "grid grid-cols-[28px_minmax(0,1fr)_128px_96px_96px_108px] items-center gap-2.5 max-[799px]:grid-cols-[28px_minmax(140px,1fr)_160px_96px_96px_148px]";
const POLE =
  "box-border w-full rounded-md border border-[#e0e0e0] bg-white font-mono text-sm text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717]";
const IKONA =
  "inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md border border-[#e0e0e0] bg-white p-0 text-[#404040] hover:bg-[#f5f5f5] aria-disabled:cursor-not-allowed aria-disabled:opacity-35 max-[799px]:size-11";

// Stan formularza z szablonu (albo pusty dla nowego)
function stanPoczatkowy(template: TemplateWithItems | null) {
  return {
    name: template?.name ?? "",
    days: template ? [...template.weekdays] : [],
    startTime: template ? template.start_time.slice(0, 5) : DOMYSLNA_GODZINA,
    rows: (template?.items ?? []).map(
      (i): Wiersz => ({
        key: i.id,
        name: i.exerciseName,
        sets: i.sets_count,
        reps: i.reps_text,
        rest: formatRest(i.rest_s),
      }),
    ),
  };
}

export function TemplateEditor({ data }: { data: TemplateEditorData }) {
  const router = useRouter();
  const { template, profile } = data;

  const [form, setForm] = useState(() => stanPoczatkowy(template));
  const [tried, setTried] = useState(false);
  const [zapisuje, setZapisuje] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);
  const licznik = useRef(0);
  const nazwaId = useId();

  // Next 16 Activity zachowuje stan trasy: nowe dane z serwera (ponowne wejście) zaczynają formularz od nowa
  const [zrodlo, setZrodlo] = useState(data);
  if (data !== zrodlo) {
    setZrodlo(data);
    setForm(stanPoczatkowy(template));
    setTried(false);
    setZapisuje(false);
    setBlad(null);
  }

  const { name, days, startTime, rows } = form;
  const nazwa = name.trim();
  const valid = nazwa !== "" && rows.length > 0;
  const serie = rows.reduce((a, r) => a + r.sets, 0);
  const meta = `${plPlural(rows.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${plPlural(serie, "seria", "serie", "serii")}`;
  const zlaPrzerwa = rows.some((r) => parseRest(r.rest) === null);
  const crumb = template ? `Edycja: ${nazwa || "bez nazwy"}` : "Nowy szablon";

  function zmienWiersz(i: number, patch: Partial<Wiersz>) {
    setForm((f) => ({
      ...f,
      rows: f.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)),
    }));
  }

  function przesun(i: number, kierunek: -1 | 1) {
    const j = i + kierunek;
    if (j < 0 || j >= rows.length) return;
    setForm((f) => {
      const nowe = [...f.rows];
      [nowe[i], nowe[j]] = [nowe[j], nowe[i]];
      return { ...f, rows: nowe };
    });
  }

  async function zapisz() {
    if (zapisuje) return;
    if (!valid || zlaPrzerwa) {
      setTried(true);
      return;
    }
    setZapisuje(true);
    setBlad(null);
    try {
      const wynik = await saveTemplate({
        ...(template ? { id: template.id } : {}),
        name: nazwa,
        weekdays: [...days].sort((a, b) => a - b),
        startTime,
        items: rows.map((r) => ({
          exerciseName: r.name,
          setsCount: r.sets,
          repsText: r.reps.trim(),
          restS: parseRest(r.rest) as number,
        })),
      });
      if (wynik.ok) {
        router.push(
          `/sport/szablony?komunikat=${template ? "zapisano" : "dodano"}&nazwa=${encodeURIComponent(nazwa)}`,
        );
        return;
      }
      setBlad(wynik.message);
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setZapisuje(false);
  }

  async function usun() {
    if (!template || zapisuje) return;
    setZapisuje(true);
    setBlad(null);
    try {
      const wynik = await deleteTemplate(template.id);
      if (wynik.ok) {
        router.push(
          `/sport/szablony?komunikat=usunieto&nazwa=${encodeURIComponent(template.name)}`,
        );
        return;
      }
      setBlad(wynik.message);
    } catch {
      setBlad(BLAD_ZAPISU);
    }
    setZapisuje(false);
  }

  // „Zapisz szablon” jak w makiecie: aria-disabled bez nazwy lub ćwiczeń, klik pokazuje „Podaj nazwę.”
  const przyciskZapisz = (
    <Button
      variant="primary"
      size="sm"
      aria-disabled={valid ? "false" : "true"}
      disabled={zapisuje}
      className={cn(!valid && "cursor-not-allowed opacity-45")}
      onClick={() => void zapisz()}
    >
      Zapisz szablon
    </Button>
  );
  const przyciskAnuluj = (
    <Button asChild size="sm">
      <Link href="/sport/szablony">Anuluj</Link>
    </Button>
  );

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex min-h-[34px] flex-wrap items-center justify-between gap-3 border-b border-[#eaeaea] px-6 py-3 max-[799px]:px-4">
        <div className="min-w-0 font-mono text-[13px] text-[#666666]">
          <Link
            href="/sport"
            className="text-[#666666] no-underline hover:text-[#171717]"
          >
            Sport
          </Link>{" "}
          <span className="text-[#b0b0b0]">/</span>{" "}
          <Link
            href="/sport/szablony"
            className="text-[#666666] no-underline hover:text-[#171717]"
          >
            Szablony treningów
          </Link>{" "}
          <span className="text-[#b0b0b0]">/</span>{" "}
          <span className="text-[#171717]">{crumb}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {przyciskAnuluj}
          {przyciskZapisz}
        </div>
      </header>

      <div className="box-border flex w-full max-w-[1100px] flex-col gap-6 px-6 py-7 max-[799px]:px-4 max-[799px]:py-5">
        <div>
          <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
            {template ? "Edytuj szablon" : "Nowy szablon"}
          </h1>
          <p className="m-0 mt-1.5 font-mono text-xs text-[#6b6b6b]">{meta}</p>
        </div>

        <section className="flex flex-col gap-4 rounded-lg border border-[#eaeaea] bg-white p-[18px]">
          <div className="grid grid-cols-2 gap-4 max-[799px]:grid-cols-1">
            <div className="flex flex-col gap-1.5 text-[13px] font-medium">
              <label htmlFor={nazwaId}>Nazwa szablonu</label>
              <input
                id={nazwaId}
                type="text"
                value={name}
                maxLength={60}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="Np. Push, Full body A"
                aria-invalid={tried && nazwa === "" ? true : undefined}
                aria-describedby={
                  tried && nazwa === "" ? `${nazwaId}-blad` : undefined
                }
                className={cn(
                  POLE,
                  "px-2.5 py-2 font-sans",
                  tried && nazwa === "" && "border-[#b91c1c]",
                )}
              />
              {tried && nazwa === "" && (
                <span
                  id={`${nazwaId}-blad`}
                  className="text-xs font-normal text-[#b91c1c]"
                >
                  Podaj nazwę.
                </span>
              )}
            </div>
            <div className="flex flex-col gap-1.5 text-[13px] font-medium">
              <span>
                Dni tygodnia{" "}
                <span className="text-xs font-normal text-[#6b6b6b]">
                  (opcjonalnie — pojawi się w kalendarzu Sport)
                </span>
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {DNI.map((etykieta, i) => {
                  const dzien = i + 1;
                  const wlaczony = days.includes(dzien);
                  return (
                    <Chip
                      key={etykieta}
                      selected={wlaczony}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          days: wlaczony
                            ? f.days.filter((d) => d !== dzien)
                            : [...f.days, dzien],
                        }))
                      }
                    >
                      {etykieta}
                    </Chip>
                  );
                })}
                {/* Godzina startu ma sens tylko, gdy szablon sam planuje treningi */}
                {days.length > 0 && (
                  <span className="ml-1 inline-flex items-center gap-1.5 text-xs font-normal text-[#6b6b6b]">
                    o
                    <TimePicker
                      value={startTime}
                      onChange={(v) => setForm((f) => ({ ...f, startTime: v }))}
                      ariaLabel="Godzina startu"
                      clock={profile.clock}
                    />
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="max-[799px]:-mx-[18px] max-[799px]:overflow-x-auto max-[799px]:px-[18px]">
              <div
                className={cn(
                  SIATKA,
                  "py-1 font-mono text-[11px] text-[#6b6b6b]",
                )}
              >
                <span>#</span>
                <span>ĆWICZENIE</span>
                <span>SERIE</span>
                <span>POWT.</span>
                <span>PRZERWA</span>
                <span />
              </div>
              {rows.map((r, i) => {
                const pierwszy = i === 0;
                const ostatni = i === rows.length - 1;
                const zla = tried && parseRest(r.rest) === null;
                return (
                  <div
                    key={r.key}
                    data-testid="wiersz-cwiczenia"
                    data-name={r.name}
                    className={cn(SIATKA, "border-b border-[#f0f0f0] py-2")}
                  >
                    <span className="font-mono text-[#6b6b6b]">{i + 1}</span>
                    <span className="min-w-0 truncate font-medium">
                      {r.name}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        className={IKONA}
                        aria-label={`${r.name}: mniej serii`}
                        onClick={() =>
                          zmienWiersz(i, { sets: Math.max(1, r.sets - 1) })
                        }
                      >
                        −
                      </button>
                      <span
                        data-testid={`serie-${r.name}`}
                        className="w-6 text-center font-mono"
                      >
                        {r.sets}
                      </span>
                      <button
                        type="button"
                        className={IKONA}
                        aria-label={`${r.name}: więcej serii`}
                        onClick={() =>
                          zmienWiersz(i, { sets: Math.min(10, r.sets + 1) })
                        }
                      >
                        +
                      </button>
                    </span>
                    <input
                      type="text"
                      value={r.reps}
                      maxLength={20}
                      onChange={(e) => zmienWiersz(i, { reps: e.target.value })}
                      aria-label={`${r.name}: powtórzenia`}
                      className={cn(POLE, "px-2 py-[5px]")}
                    />
                    <input
                      type="text"
                      value={r.rest}
                      onChange={(e) => zmienWiersz(i, { rest: e.target.value })}
                      aria-label={`${r.name}: przerwa`}
                      aria-invalid={zla ? true : undefined}
                      className={cn(
                        POLE,
                        "px-2 py-[5px]",
                        zla && "border-[#b91c1c]",
                      )}
                    />
                    <span className="inline-flex justify-end gap-1">
                      <button
                        type="button"
                        className={IKONA}
                        aria-label={`Przesuń ${r.name} w górę`}
                        aria-disabled={pierwszy ? "true" : "false"}
                        onClick={() => przesun(i, -1)}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={IKONA}
                        aria-label={`Przesuń ${r.name} w dół`}
                        aria-disabled={ostatni ? "true" : "false"}
                        onClick={() => przesun(i, 1)}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={cn(IKONA, "text-[#b91c1c]")}
                        aria-label={`Usuń ${r.name}`}
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            rows: f.rows.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        ✕
                      </button>
                    </span>
                  </div>
                );
              })}
            </div>
            {rows.length === 0 && (
              <p className="m-0 py-3.5 text-xs text-[#6b6b6b]">
                Brak ćwiczeń — dodaj pierwsze poniżej.
              </p>
            )}
            {tried && zlaPrzerwa && (
              <p className="m-0 pt-2 text-xs text-[#b91c1c]">
                Przerwa w formacie m:ss, np. 2:00.
              </p>
            )}
            <div className="mt-3 self-start">
              <ExercisePicker
                exercises={data.exercises}
                excludeNames={rows.map((r) => r.name)}
                side="bottom"
                onPick={(nazwaCwiczenia) => {
                  licznik.current += 1;
                  setForm((f) => ({
                    ...f,
                    rows: [
                      ...f.rows,
                      {
                        key: `nowe-${licznik.current}`,
                        name: nazwaCwiczenia,
                        sets: 3,
                        reps: "8–10",
                        rest: "2:00",
                      },
                    ],
                  }));
                }}
              />
            </div>
          </div>
        </section>

        {blad && (
          <p role="alert" className="m-0 text-[13px] text-[#b91c1c]">
            {blad}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {przyciskZapisz}
            {przyciskAnuluj}
          </div>
          {template && (
            <Button
              size="sm"
              disabled={zapisuje}
              className="border-[#f3c7c7] text-[#b91c1c] hover:text-[#b91c1c]"
              onClick={() => void usun()}
            >
              Usuń szablon
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
