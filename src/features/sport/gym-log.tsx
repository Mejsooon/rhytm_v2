"use client";

// Ekran treningu siłowego na komputerze (GymLog.dc.html): ścieżka z „Zapisz jako szablon” i „Zakończ trening”,
// objętość i serie, karty ćwiczeń z edycją serii (kg / powt. / ✓ / ✕), REKORD, linia 1RM i „+ Ćwiczenie”.
// Stan serii trzyma use-gym-store — jeden na ekran, przekazany też do drzewa telefonu (MGym).
// Oba drzewa są w DOM; przełącza je wyłącznie CSS (800 px).
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import {
  Button,
  Checkbox,
  FormDialog,
  MonoLabel,
  TextField,
} from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import { formatClockTime } from "@/lib/time/timezones";
import { finishWorkout, saveSessionAsTemplate } from "./actions";
import { ExercisePicker } from "./exercise-picker";
import { MGym } from "./mobile/m-gym";
import type { WorkoutData } from "./load-sport";
import {
  effectiveKg,
  epley1rm,
  formatKg,
  formatVolume,
  kgVsLast,
  recordSetIds,
} from "./model";
import { isTempId, useGymStore } from "./use-gym-store";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const POLE =
  "box-border w-full rounded-md border border-input bg-white px-2 py-[5px] text-sm text-foreground outline-none placeholder:text-faint-foreground focus:border-primary disabled:bg-panel";
const AKCJA_KARTY =
  "mt-1.5 cursor-pointer rounded-md border-0 bg-transparent px-2 py-1.5 text-[13px] hover:bg-muted disabled:cursor-default disabled:opacity-50";

export function GymLog({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { session, profile } = data;
  const sklep = useGymStore(data);

  const [konczy, setKonczy] = useState(false);
  const [oknoSzablonu, setOknoSzablonu] = useState(false);
  const [nazwaSzablonu, setNazwaSzablonu] = useState(session.title);
  const [bladSzablonu, setBladSzablonu] = useState<string | null>(null);
  const [zapisujeSzablon, setZapisujeSzablon] = useState(false);

  // Data i godziny: koniec z end_local, a bez niego start + 90 min (Ruling „Czas trwania do rysowania”)
  const data10 = session.start_local.slice(0, 10);
  const [rok, mm, dd] = data10.split("-");
  const dzien = DNI[weekdayOf(data10)];
  const startMin =
    Number(session.start_local.slice(11, 13)) * 60 +
    Number(session.start_local.slice(14, 16));
  const koniecMin = session.end_local
    ? Number(session.end_local.slice(11, 13)) * 60 +
      Number(session.end_local.slice(14, 16))
    : (startMin + 90) % 1440;
  const godziny = `${formatClockTime(Math.floor(startMin / 60), startMin % 60, profile.clock)}–${formatClockTime(Math.floor(koniecMin / 60), koniecMin % 60, profile.clock)}`;
  const podtytul = `${dzien} ${dd}.${mm}.${rok} · ${godziny}${data.templateName ? ` · z szablonu „${data.templateName}”` : ""}`;

  // Historia z bieżącymi seriami tego treningu (REKORD i „vs ostatnio” zmieniają się na żywo).
  // Ten trening liczymy jak zakończony — po „Zakończ” pozostałe widoki pokażą te same plakietki.
  const serieTeraz = sklep.exercises.flatMap((e) => e.sets);
  const historia = data.history.some((h) => h.sessionId === session.id)
    ? data.history.map((h) =>
        h.sessionId === session.id
          ? { ...h, completed: true, sets: serieTeraz }
          : h,
      )
    : [
        ...data.history,
        {
          sessionId: session.id,
          startLocal: session.start_local,
          completed: true,
          sets: serieTeraz,
        },
      ];

  async function zakoncz() {
    const powrot = `/sport?miesiac=${session.start_local.slice(0, 7)}`;
    // Trening już zakończony: tylko powrót, bez nadpisywania end_local
    if (session.completed) {
      router.push(powrot);
      return;
    }
    setKonczy(true);
    try {
      const wynik = await finishWorkout(session.id);
      if (wynik.ok) {
        router.push(powrot);
        return;
      }
      toast.error(wynik.message);
    } catch {
      toast.error(BLAD_ZAPISU);
    }
    setKonczy(false);
  }

  async function zapiszSzablon(e: FormEvent) {
    e.preventDefault();
    const nazwa = nazwaSzablonu.trim();
    if (nazwa === "" || zapisujeSzablon) return;
    setZapisujeSzablon(true);
    setBladSzablonu(null);
    try {
      const wynik = await saveSessionAsTemplate(session.id, nazwa);
      if (wynik.ok) {
        setOknoSzablonu(false);
        toast.success(`Zapisano szablon „${nazwa}”.`);
      } else {
        setBladSzablonu(wynik.message);
      }
    } catch {
      setBladSzablonu(BLAD_ZAPISU);
    }
    setZapisujeSzablon(false);
  }

  return (
    <>
      <div
        data-testid="m-gym"
        className="flex min-w-0 flex-col min-[800px]:hidden"
      >
        <MGym
          data={data}
          store={sklep}
          finishing={konczy}
          onFinish={() => void zakoncz()}
        />
      </div>
      <div
        data-testid="web-gym"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        <header className="flex min-h-[34px] flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-3">
          <div className="font-mono text-[13px] text-muted-foreground">
            <Link
              href={`/sport?miesiac=${data10.slice(0, 7)}`}
              className="text-muted-foreground no-underline hover:text-foreground"
            >
              Sport
            </Link>{" "}
            <span className="text-faint-foreground">/</span>{" "}
            <span className="text-foreground">{`${session.title} · ${dzien} ${dd}.${mm}`}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => {
                setNazwaSzablonu(session.title);
                setBladSzablonu(null);
                setOknoSzablonu(true);
              }}
            >
              Zapisz jako szablon
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={konczy}
              onClick={() => void zakoncz()}
            >
              Zakończ trening
            </Button>
          </div>
        </header>

        <div className="box-border flex w-full max-w-[1100px] flex-col gap-5 px-6 py-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="m-0 text-2xl font-semibold tracking-[-0.02em]">
                {session.title}
              </h1>
              <p className="m-0 mt-1.5 font-mono text-xs text-muted-foreground">
                {podtytul}
              </p>
            </div>
            <div className="grid grid-cols-[repeat(2,auto)] gap-px overflow-hidden rounded-lg border border-border bg-border">
              <div className="bg-white px-4 py-2.5">
                <MonoLabel className="block">Objętość</MonoLabel>
                <div data-testid="objetosc" className="mt-1 font-mono text-lg">
                  {`${formatVolume(sklep.volume)} kg`}
                </div>
              </div>
              <div className="bg-white px-4 py-2.5">
                <MonoLabel className="block">Serie</MonoLabel>
                <div data-testid="serie" className="mt-1 font-mono text-lg">
                  {`${sklep.doneCount} / ${sklep.totalCount}`}
                </div>
              </div>
            </div>
          </div>

          {sklep.exercises.map((cwiczenie) => {
            const tymczasowe = isTempId(cwiczenie.id);
            const naglowekId = `cwiczenie-${cwiczenie.id}`;
            const zMasaCiala = cwiczenie.bodyweight;
            const rekordowe = recordSetIds(
              historia,
              cwiczenie.id,
              zMasaCiala,
              profile.weightKg,
            );

            // 1RM (Epley) z zrobionych serii z (efektywnym) ciężarem i powt. ≥ 1
            let najlepszy: number | null = null;
            for (const s of cwiczenie.sets) {
              const kg = effectiveKg(s.weight_kg, zMasaCiala, profile.weightKg);
              if (!s.done || kg === null || s.reps === null) continue;
              if (s.reps < 1) continue;
              const v = epley1rm(kg, s.reps);
              if (najlepszy === null || v > najlepszy) najlepszy = v;
            }
            // „+2,5 kg vs ostatnio” — bez dopisku przy braku poprzedniej sesji albo bez różnicy
            const roznica = kgVsLast(
              historia,
              session.id,
              cwiczenie.id,
              zMasaCiala,
              profile.weightKg,
            );
            const zaokraglona =
              roznica === null ? 0 : Math.round(roznica * 100) / 100;
            const linia1rm = `1RM ${najlepszy === null ? "—" : `${formatKg(najlepszy)} kg`}${zaokraglona !== 0 ? ` · ${zaokraglona > 0 ? "+" : "−"}${formatKg(Math.abs(zaokraglona))} kg vs ostatnio` : ""}`;

            return (
              <section
                key={cwiczenie.id}
                aria-labelledby={naglowekId}
                className="rounded-lg border border-border bg-white px-4 py-3.5"
              >
                <div className="mb-1.5 flex items-baseline justify-between gap-2.5">
                  {tymczasowe ? (
                    <span id={naglowekId} className="font-semibold">
                      {cwiczenie.name}
                    </span>
                  ) : (
                    <Link
                      id={naglowekId}
                      href={`/sport/cwiczenia/${cwiczenie.id}`}
                      className="font-semibold text-foreground no-underline hover:text-black"
                    >
                      {cwiczenie.name}
                    </Link>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {linia1rm}
                  </span>
                </div>
                <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_44px] gap-2 border-b border-border py-1 font-mono text-[11px] text-muted-foreground">
                  <span>seria</span>
                  <span>{zMasaCiala ? "kg (mc + dociążenie)" : "kg"}</span>
                  <span>powt.</span>
                  <span>✓</span>
                </div>
                {cwiczenie.sets.map((s, j) => {
                  const etykieta = `${cwiczenie.name}, seria ${j + 1}`;
                  const szkic = sklep.drafts.get(s.id);
                  const zablokowana = isTempId(s.id);
                  return (
                    <div
                      key={s.id}
                      data-testid={`seria-${cwiczenie.name}-${j + 1}`}
                      className={`group grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_44px_28px] items-center gap-2 py-1.5 font-mono ${s.done ? "text-muted-foreground" : ""}`}
                    >
                      <span>{j + 1}</span>
                      {zMasaCiala ? (
                        // Masa ciała z profilu + pole dociążenia (puste = bez dociążenia)
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span
                            title="Masa ciała z profilu"
                            className="flex-none rounded border border-input bg-panel px-1.5 py-[3px] text-[11px] text-soft-foreground"
                          >
                            mc
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="+ kg"
                            aria-label={`${etykieta} — dociążenie (kg)`}
                            disabled={zablokowana}
                            value={
                              szkic?.kg ??
                              (s.weight_kg === null || s.weight_kg === 0
                                ? ""
                                : formatKg(s.weight_kg))
                            }
                            onChange={(e) =>
                              sklep.setDraft(s.id, "kg", e.target.value)
                            }
                            onBlur={() => void sklep.commitDraft(s.id, "kg")}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") e.currentTarget.blur();
                            }}
                            className={`${POLE} min-w-0`}
                          />
                        </span>
                      ) : (
                        <input
                          type="text"
                          inputMode="decimal"
                          placeholder="kg"
                          aria-label={`${etykieta} — ciężar`}
                          disabled={zablokowana}
                          value={
                            szkic?.kg ??
                            (s.weight_kg === null ? "" : formatKg(s.weight_kg))
                          }
                          onChange={(e) =>
                            sklep.setDraft(s.id, "kg", e.target.value)
                          }
                          onBlur={() => void sklep.commitDraft(s.id, "kg")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className={POLE}
                        />
                      )}
                      <div className="relative">
                        <input
                          type="text"
                          inputMode="numeric"
                          placeholder="powt."
                          aria-label={`${etykieta} — powtórzenia`}
                          disabled={zablokowana}
                          value={
                            szkic?.reps ??
                            (s.reps === null ? "" : String(s.reps))
                          }
                          onChange={(e) =>
                            sklep.setDraft(s.id, "reps", e.target.value)
                          }
                          onBlur={() => void sklep.commitDraft(s.id, "reps")}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") e.currentTarget.blur();
                          }}
                          className={POLE}
                        />
                        {rekordowe.has(s.id) && (
                          <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded border border-success-border bg-success-soft px-1.5 py-px font-mono text-[10px] text-success">
                            REKORD
                          </span>
                        )}
                      </div>
                      <Checkbox
                        checked={s.done}
                        ariaLabel={`${etykieta} zrobiona`}
                        disabled={zablokowana}
                        onChange={() => void sklep.toggleDone(s.id)}
                      />
                      <button
                        type="button"
                        aria-label={`Usuń ${etykieta}`}
                        disabled={zablokowana}
                        onClick={() => void sklep.deleteSet(s.id)}
                        className="cursor-pointer border-0 bg-transparent p-1 text-faint-foreground opacity-0 transition-opacity duration-[120ms] group-hover:opacity-100 focus-visible:opacity-100 disabled:cursor-default"
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                {zMasaCiala && (
                  <div className="pt-1.5 font-mono text-[11px] text-muted-foreground">
                    {profile.weightKg !== null ? (
                      `mc = masa ciała ${formatKg(profile.weightKg)} kg z profilu · „+ kg” to dociążenie (opcjonalnie)`
                    ) : (
                      <>
                        Uzupełnij wagę w profilu (
                        <Link
                          href="/ustawienia/ogolne"
                          className="text-foreground underline"
                        >
                          Ustawienia → Profil
                        </Link>
                        ), żeby liczyć objętość i rekordy.
                      </>
                    )}
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    disabled={tymczasowe}
                    onClick={() => void sklep.addSet(cwiczenie.id)}
                    className={`${AKCJA_KARTY} -ml-2 text-muted-foreground hover:text-foreground`}
                  >
                    + Seria
                  </button>
                  <button
                    type="button"
                    disabled={tymczasowe}
                    onClick={() => void sklep.removeExercise(cwiczenie.id)}
                    className={`${AKCJA_KARTY} -mr-2 text-destructive-foreground`}
                  >
                    Usuń ćwiczenie
                  </button>
                </div>
              </section>
            );
          })}

          <div className="relative self-start">
            <ExercisePicker
              exercises={data.exercises}
              excludeNames={sklep.exercises.map((e) => e.name)}
              onPick={(name) => void sklep.addExercise(name)}
            />
          </div>
        </div>
      </div>

      <FormDialog
        open={oknoSzablonu}
        onOpenChange={(v) => {
          if (!zapisujeSzablon) setOknoSzablonu(v);
        }}
        title="Zapisz jako szablon"
        footer={
          <>
            <Button
              size="sm"
              disabled={zapisujeSzablon}
              onClick={() => setOknoSzablonu(false)}
            >
              Anuluj
            </Button>
            <Button
              type="submit"
              form="zapisz-szablon"
              variant="primary"
              size="sm"
              disabled={zapisujeSzablon || nazwaSzablonu.trim() === ""}
            >
              Zapisz
            </Button>
          </>
        }
      >
        <form id="zapisz-szablon" onSubmit={(e) => void zapiszSzablon(e)}>
          <TextField
            label="Nazwa szablonu"
            value={nazwaSzablonu}
            maxLength={60}
            onChange={(e) => setNazwaSzablonu(e.target.value)}
            error={bladSzablonu ?? undefined}
          />
        </form>
      </FormDialog>
    </>
  );
}
