"use client";

// Ekran treningu siłowego na komputerze (GymLog.dc.html): ścieżka z „Zapisz jako szablon” i „Zakończ trening”,
// objętość i serie, karty ćwiczeń z edycją serii (kg / powt. / ✓ / ✕), REKORD, linia 1RM i „+ Ćwiczenie”.
// Stan serii trzyma use-gym-store — jeden na ekran, przekazany też do drzewa telefonu (MGym).
// Oba drzewa są w DOM; przełącza je wyłącznie CSS (800 px).
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2Icon, XIcon } from "lucide-react";

import {
  Button,
  Checkbox,
  FIELD,
  FormDialog,
  StatusBadge,
  TextField,
} from "@/components/controls";
import { cn } from "@/lib/utils";
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
// Pole serii jak .inp 30 px z makiety (wspólne FIELD, na telefonie 44 px)
const POLE = cn(FIELD, "h-[30px] tabular-nums");

export function GymLog({ data }: { data: WorkoutData }) {
  const router = useRouter();
  const { session, profile } = data;
  const sklep = useGymStore(data);
  // Po „+ Seria”: czekamy, aż nowa seria dostanie id z serwera (pola są wtedy aktywne), i dajemy fokus jej polu kg
  const fokusSerii = useRef<{ exerciseId: string; liczba: number } | null>(
    null,
  );
  useEffect(() => {
    const cel = fokusSerii.current;
    if (!cel) return;
    const cw = sklep.exercises.find((e) => e.id === cel.exerciseId);
    if (!cw) {
      fokusSerii.current = null;
      return;
    }
    const ostatnia = cw.sets[cw.sets.length - 1];
    if (cw.sets.length <= cel.liczba || !ostatnia || isTempId(ostatnia.id))
      return;
    document
      .querySelector<HTMLInputElement>(`[data-kg-serii="${ostatnia.id}"]`)
      ?.focus();
    fokusSerii.current = null;
  }, [sklep.exercises]);

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
          onSaveTemplate={() => {
            setNazwaSzablonu(session.title);
            setBladSzablonu(null);
            setOknoSzablonu(true);
          }}
        />
      </div>
      <div
        data-testid="web-gym"
        className="flex min-w-0 flex-col max-[799px]:hidden"
      >
        {/* .topbar z okruszkami .crumb (CGymLog) */}
        <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5">
          <nav
            aria-label="Okruszki"
            className="flex items-center gap-1.5 text-sm text-muted-foreground"
          >
            <Link
              href={`/sport?miesiac=${data10.slice(0, 7)}`}
              className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus"
            >
              Sport
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-foreground">{`${session.title} · ${dzien} ${dd}.${mm}`}</span>
          </nav>
          <div className="flex flex-wrap items-center gap-2">
            <Button
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
              <div className="mt-2">
                <StatusBadge tone="gray" size="lg" className="tabular-nums">
                  {podtytul}
                </StatusBadge>
              </div>
            </div>
            {/* .frame > .inner: ramka 1,5 px z dwiema komórkami */}
            <div className="rounded-xl p-[3px]">
              <div
                data-testid="podsumowanie-treningu"
                className="grid grid-cols-[repeat(2,auto)] overflow-hidden rounded-xl border-[1.5px] border-border-strong bg-white"
              >
                <div className="px-[18px] py-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Objętość
                  </div>
                  <div
                    data-testid="objetosc"
                    className="mt-1 text-lg font-semibold tabular-nums"
                  >
                    {`${formatVolume(sklep.volume)} kg`}
                  </div>
                </div>
                <div className="border-l border-border px-[18px] py-2.5">
                  <div className="text-xs font-medium text-muted-foreground">
                    Serie
                  </div>
                  <div
                    data-testid="serie"
                    className="mt-1 text-lg font-semibold tabular-nums"
                  >
                    {`${sklep.doneCount} / ${sklep.totalCount}`}
                  </div>
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
                // .card z coss.css (jak Card, ale jako region)
                className="relative flex flex-col rounded-xl border border-border bg-white bg-clip-padding shadow-card"
              >
                <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-2.5">
                  {tymczasowe ? (
                    <span id={naglowekId} className="text-[15px] font-semibold">
                      {cwiczenie.name}
                    </span>
                  ) : (
                    <Link
                      id={naglowekId}
                      href={`/sport/cwiczenia/${cwiczenie.id}`}
                      className="text-[15px] font-semibold text-foreground no-underline outline-none hover:text-black focus-visible:shadow-focus"
                    >
                      {cwiczenie.name}
                    </Link>
                  )}
                  <StatusBadge tone="gray" className="tabular-nums">
                    {linia1rm}
                  </StatusBadge>
                </div>
                <div className="px-5">
                  <div className="grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_32px_28px] gap-2 border-b border-border py-1.5 text-xs font-medium text-muted-foreground">
                    <span>seria</span>
                    <span>{zMasaCiala ? "kg (mc + dociążenie)" : "kg"}</span>
                    <span>powt.</span>
                    <span>✓</span>
                    <span />
                  </div>
                  {cwiczenie.sets.map((s, j) => {
                    const etykieta = `${cwiczenie.name}, seria ${j + 1}`;
                    const szkic = sklep.drafts.get(s.id);
                    const zablokowana = isTempId(s.id);
                    return (
                      <div
                        key={s.id}
                        data-testid={`seria-${cwiczenie.name}-${j + 1}`}
                        // Zrobiona seria: zielony gradient z lewej jak w makiecie
                        className={cn(
                          "grid grid-cols-[40px_minmax(0,1fr)_minmax(0,1fr)_32px_28px] items-center gap-2 border-b border-black/5 py-1.5",
                          s.done &&
                            "bg-gradient-to-r from-success/[.06] to-transparent to-60%",
                        )}
                      >
                        <StatusBadge tone="gray" className="w-6 tabular-nums">
                          {j + 1}
                        </StatusBadge>
                        {zMasaCiala ? (
                          // Masa ciała z profilu + pole dociążenia (puste = bez dociążenia); .igroup z makiety
                          <span
                            className={cn(
                              "flex h-[30px] min-w-0 items-center gap-2 rounded-md border border-input bg-white pr-[11px] pl-1 shadow-xs transition-[box-shadow,border-color] duration-150 focus-within:border-ring focus-within:shadow-halo",
                              zablokowana && "cursor-not-allowed opacity-[.64]",
                            )}
                          >
                            <span
                              title="Masa ciała z profilu"
                              className="flex-none"
                            >
                              <StatusBadge tone="gray">mc</StatusBadge>
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="+ kg"
                              aria-label={`${etykieta} — dociążenie (kg)`}
                              data-kg-serii={s.id}
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
                              className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground tabular-nums outline-none placeholder:text-faint-foreground disabled:cursor-not-allowed"
                            />
                          </span>
                        ) : (
                          <input
                            type="text"
                            inputMode="decimal"
                            placeholder="kg"
                            aria-label={`${etykieta} — ciężar`}
                            data-kg-serii={s.id}
                            disabled={zablokowana}
                            value={
                              szkic?.kg ??
                              (s.weight_kg === null
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
                            <StatusBadge
                              tone="green"
                              className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2"
                            >
                              REKORD
                            </StatusBadge>
                          )}
                        </div>
                        <Checkbox
                          checked={s.done}
                          ariaLabel={`${etykieta} zrobiona`}
                          disabled={zablokowana}
                          onChange={() => void sklep.toggleDone(s.id)}
                        />
                        <Button
                          variant="ghost"
                          size="xs"
                          icon
                          aria-label={`Usuń ${etykieta}`}
                          disabled={zablokowana}
                          onClick={() => void sklep.deleteSet(s.id)}
                          className="text-faint-foreground hover:text-foreground"
                        >
                          <XIcon aria-hidden="true" className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  {zMasaCiala && (
                    <div className="pt-1.5 text-xs text-muted-foreground">
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
                </div>
                <div className="flex items-center justify-between px-3 pt-2 pb-2.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tymczasowe}
                    onClick={() => {
                      fokusSerii.current = {
                        exerciseId: cwiczenie.id,
                        liczba: cwiczenie.sets.length,
                      };
                      void sklep.addSet(cwiczenie.id);
                    }}
                    className="text-muted-foreground"
                  >
                    + Seria
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={tymczasowe}
                    onClick={() => void sklep.removeExercise(cwiczenie.id)}
                    className="text-destructive-foreground hover:text-destructive-foreground"
                  >
                    <Trash2Icon aria-hidden="true" className="size-4" />
                    Usuń ćwiczenie
                  </Button>
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
              variant="ghost"
              size="sm"
              disabled={zapisujeSzablon}
              onClick={() => setOknoSzablonu(false)}
              className="max-[799px]:h-11"
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
