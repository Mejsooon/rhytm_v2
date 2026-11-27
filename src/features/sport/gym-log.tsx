"use client";

// Dziennik treningu siłowego (S2GymLog / CMGym) — jedno drzewo dla komputera i telefonu (próg 800 px).
// Przed startem: „Rozpocznij”; w trakcie: licznik, „Zakończ”, „Odrzuć”; po zakończeniu („Edytuj” z podsumowania):
// bez licznika, „Gotowe”. Stan serii trzyma use-gym-store, okna są w gym-dialogs.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, ChevronLeft, MoreHorizontal, Play, Plus, Timer, X } from "lucide-react";

import { ActionPopover, Button, Card, ConfirmDialog, MENU_ITEM, MENU_ITEM_DANGER, MENU_SEPARATOR, Progress, StatusBadge } from "@/components/controls";
import { weekdayOf } from "@/features/calendar/view-range";
import type { ActionResult } from "@/lib/action-result";
import { formatClockTime } from "@/lib/time/timezones";
import { cn } from "@/lib/utils";
import { discardWorkout, finishWorkout, saveExercise, saveSessionAsTemplate, startWorkout, updateExercise, type ExerciseInput, type SetPatch } from "./actions";
import { ExerciseFormDialog, ExercisePickDialog, FinishDialog, RestBar, type Rest } from "./gym-dialogs";
import type { WorkoutData } from "./load-sport";
import {
  effectiveKg,
  EXERCISE_KINDS,
  firstReps,
  formatDuration,
  formatKg,
  formatSet,
  formatVolume,
  plPlural,
  previousSets,
  recordSetIds,
  SET_TYPES,
  setLabels,
  type GymSetRow,
  type HistorySession,
} from "./model";
import { isTempId, useGymStore, type DraftField, type GymExercise, type GymStore } from "./use-gym-store";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
export const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const PRZERWY = [60, 90, 120, 180];
// Seria · Poprzednio · A · B · ✓ · ✕ (telefon bez ✕, jak w CMGym)
const KOLUMNY =
  "grid grid-cols-[34px_minmax(0,1fr)_62px_62px_40px] items-center gap-1.5 px-3 min-[800px]:grid-cols-[48px_minmax(0,1fr)_96px_96px_40px_32px] min-[800px]:gap-2.5 min-[800px]:px-6";
const POLE =
  "box-border h-9 w-full min-w-0 rounded-lg border border-black/10 bg-white px-1 text-center text-base tabular-nums outline-none placeholder:text-faint-foreground focus:border-primary disabled:opacity-60 min-[800px]:h-8 min-[800px]:text-sm";
const KOLOR_TYPU: Record<string, string> = {
  W: "bg-[#f59e0b]/[.14] text-[#b45309]",
  D: "bg-[#7c3aed]/[.12] text-[#6d28d9]",
  F: "bg-[#dc2626]/10 text-[#b91c1c]",
};

const licznikTekst = (s: number) =>
  `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

// Historia z bieżącymi seriami treningu liczonego jak zakończony (rekordy widać na żywo)
export function historiaZTreningiem(data: WorkoutData, serie: GymSetRow[]): HistorySession[] {
  const { id, start_local } = data.session;
  return [
    ...data.history.filter((h) => h.sessionId !== id),
    { sessionId: id, startLocal: start_local, completed: true, sets: serie },
  ];
}

export function GymLog({ data, onDone }: { data: WorkoutData; onDone?: () => void }) {
  const router = useRouter();
  const { session, profile } = data;
  const sklep = useGymStore(data);
  const edycja = session.completed;
  const [start, setStart] = useState(() => (session.started_at ? Date.parse(session.started_at) : null));
  const [teraz, setTeraz] = useState<number | null>(null);
  const [przerwa, setPrzerwa] = useState<Rest | null>(null);
  const zamknijPrzerwe = useCallback(() => setPrzerwa(null), []);
  const [wybor, setWybor] = useState(false);
  const [zaznaczone, setZaznaczone] = useState<string[]>([]);
  const [formularz, setFormularz] = useState<ExerciseInput | null>(null);
  const [okno, setOkno] = useState<"koniec" | "odrzuc" | null>(null);
  const [czeka, setCzeka] = useState(false);

  const trwa = !edycja && start !== null;
  useEffect(() => {
    if (!trwa) return;
    const odczytaj = () => setTeraz(Date.now());
    odczytaj();
    const zegar = setInterval(odczytaj, 1000);
    return () => clearInterval(zegar);
  }, [trwa]);
  const czas = trwa && teraz !== null ? licznikTekst(Math.max(0, Math.floor((teraz - start) / 1000))) : "—";

  const data10 = session.start_local.slice(0, 10);
  const [rok, mm, dd] = data10.split("-");
  const dzien = DNI[weekdayOf(data10)];
  const godzina = formatClockTime(Number(session.start_local.slice(11, 13)), Number(session.start_local.slice(14, 16)), profile.clock);
  const podtytul = [
    `${dzien} ${dd}.${mm}.${rok}`,
    !edycja && !trwa ? `w planie na ${godzina}` : null,
    data.templateName ? `z szablonu „${data.templateName}”` : "pusty trening",
    trwa ? `start ${godzina}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const serie = sklep.exercises.flatMap((e) => e.sets);
  const historia = historiaZTreningiem(data, serie);
  const rekordy = sklep.exercises.flatMap((e) => {
    const ids = recordSetIds(historia, e.id, e.bodyweight, profile.weightKg);
    const s = e.sets.find((x) => ids.has(x.id));
    return s ? [{ exerciseId: e.id, tekst: `${e.name} · ${formatSet(s, e.kind) ?? ""}` }] : [];
  });
  const powrot = `/sport?miesiac=${data10.slice(0, 7)}`;

  // Akcja z komunikatem błędu; true = poszło
  async function wyslij(akcja: () => Promise<ActionResult>): Promise<boolean> {
    try {
      const wynik = await akcja();
      if (wynik.ok) return true;
      toast.error(wynik.message);
    } catch {
      toast.error(BLAD_ZAPISU);
    }
    return false;
  }

  function rozpocznij() {
    if (edycja || start !== null) return;
    setStart(Date.now());
    void wyslij(() => startWorkout(session.id)).then((ok) => {
      if (!ok) setStart(null);
    });
  }

  async function zakoncz(dane: { difficulty: number | null; note: string; template: boolean }) {
    setCzeka(true);
    // Szablon przed zakończeniem: bierze też nieodhaczone serie
    if (dane.template) await wyslij(() => saveSessionAsTemplate(session.id, session.title));
    const ok = await wyslij(() => finishWorkout(session.id, { difficulty: dane.difficulty, note: dane.note }));
    setCzeka(false);
    if (!ok) return;
    setOkno(null);
    setPrzerwa(null);
    // Makiety: na komputerze po zapisie wracamy do Sportu, na telefonie zostaje podsumowanie
    if (window.matchMedia("(min-width: 800px)").matches) router.push(powrot);
  }

  async function odrzuc() {
    setCzeka(true);
    if (await wyslij(() => discardWorkout(session.id))) {
      router.push(powrot);
      return;
    }
    setCzeka(false);
  }

  // Dodawane po kolei, żeby każde dostało następną pozycję
  async function dodaj(nazwy: string[]) {
    setZaznaczone([]);
    for (const n of nazwy) await sklep.addExercise(n);
  }

  async function zapiszCwiczenie(input: ExerciseInput) {
    const ok = await wyslij(() => saveExercise(input, session.id));
    if (!ok) return false;
    setFormularz(null);
    // Nowe ćwiczenie od razu zaznaczone w oknie wyboru
    if (!input.id) setZaznaczone((z) => [...z, input.name]);
    return true;
  }

  const przyciski = edycja ? (
    <Button variant="primary" onClick={onDone}>
      Gotowe
    </Button>
  ) : trwa ? (
    <Button variant="primary" onClick={() => setOkno("koniec")}>
      Zakończ<span className="max-[799px]:hidden"> trening</span>
    </Button>
  ) : (
    <>
      <Button variant="ghost" asChild className="max-[799px]:hidden">
        <Link href={powrot}>Anuluj</Link>
      </Button>
      <Button variant="primary" onClick={rozpocznij}>
        <Play size={14} fill="currentColor" aria-hidden="true" />
        Rozpocznij<span className="max-[799px]:hidden"> trening</span>
      </Button>
    </>
  );

  return (
    <div className="flex min-w-0 flex-col">
      <header className="flex min-h-[52px] items-center gap-2 border-b border-border px-2 py-1.5 min-[800px]:px-6">
        <Button variant="ghost" icon asChild className="min-[800px]:hidden">
          <Link href={powrot} aria-label="Wróć do Sportu">
            <ChevronLeft size={20} aria-hidden="true" />
          </Link>
        </Button>
        <nav aria-label="Okruszki" className="flex min-w-0 items-center gap-1.5 text-muted-foreground max-[799px]:hidden">
          <Link href={powrot} className="text-muted-foreground no-underline outline-none hover:text-foreground focus-visible:shadow-focus">
            Sport
          </Link>
          <span aria-hidden="true">/</span>
          <span className="truncate font-medium text-foreground">{`${session.title} · ${dzien} ${dd}.${mm}`}</span>
        </nav>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-2 min-[800px]:justify-end">
          {trwa && (
            <span role="status" className="flex items-center gap-1.5 text-[13px] font-medium text-success">
              <span aria-hidden="true" className="size-2 animate-pulse rounded-full bg-success" />
              <span className="max-[799px]:hidden">Trwa ·</span>
              <span className="tabular-nums">{czas}</span>
            </span>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">{przyciski}</div>
      </header>

      <div className="box-border flex w-full max-w-[960px] flex-col gap-3 p-3 pb-28 min-[800px]:gap-4 min-[800px]:p-6 min-[800px]:pb-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="m-0 text-xl font-semibold tracking-[-0.02em] min-[800px]:text-2xl">{session.title}</h1>
            <p className="m-0 mt-1 text-muted-foreground tabular-nums">{podtytul}</p>
          </div>
          <div className="grid grid-cols-3 gap-4 max-[799px]:w-full min-[800px]:flex min-[800px]:gap-7">
            {(
              [
                ["Czas", czas, "czas"],
                ["Objętość", `${formatVolume(sklep.volume)} kg`, "objetosc"],
                ["Serie", `${sklep.doneCount} / ${sklep.totalCount}`, "serie"],
              ] as const
            ).map(([k, v, id]) => (
              <div key={id} className="flex flex-col gap-0.5">
                <span className="text-xs text-muted-foreground">{k}</span>
                <b data-testid={id} className="text-lg font-semibold tabular-nums">
                  {v}
                </b>
              </div>
            ))}
          </div>
        </div>
        <Progress value={sklep.doneCount} max={Math.max(1, sklep.totalCount)} ariaLabel="Postęp serii" className="h-1 flex-none" />

        {!edycja && !trwa && sklep.exercises.length > 0 && (
          <div className="flex items-center gap-4 rounded-xl border border-dashed border-black/[.18] bg-black/[.015] px-4 py-3.5 min-[800px]:px-5 min-[800px]:py-4">
            <span aria-hidden="true" className="grid size-10 flex-none place-items-center rounded-xl bg-primary text-primary-foreground max-[799px]:hidden">
              <Play size={16} fill="currentColor" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold">
                {`Gotowy na ${session.title}? ${plPlural(sklep.exercises.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")} · ${plPlural(sklep.totalCount, "seria", "serie", "serii")}`}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Sprawdź plan, popraw ciężary albo dodaj ćwiczenia. Czas ruszy po „Rozpocznij” albo po odhaczeniu pierwszej serii.
              </div>
            </div>
            <Button variant="primary" onClick={rozpocznij}>
              Rozpocznij
            </Button>
          </div>
        )}
        {sklep.exercises.length === 0 && (
          <Card className="flex flex-col items-center gap-3 px-6 py-10 text-center">
            <b className="font-semibold">Pusty trening</b>
            <span className="text-muted-foreground">Dodaj pierwsze ćwiczenie, żeby zacząć zapisywać serie.</span>
            <Button variant="primary" onClick={() => setWybor(true)}>
              Dodaj ćwiczenie
            </Button>
          </Card>
        )}

        {sklep.exercises.map((cwiczenie) => (
          <ExerciseCard
            key={cwiczenie.id}
            data={data}
            store={sklep}
            exercise={cwiczenie}
            record={rekordy.some((r) => r.exerciseId === cwiczenie.id)}
            onDone={(rest) => {
              setPrzerwa({ end: Date.now() + rest * 1000, total: rest });
              rozpocznij();
            }}
            onEdit={() => {
              const e = data.exercises.find((x) => x.id === cwiczenie.id);
              setFormularz({
                id: cwiczenie.id,
                name: cwiczenie.name,
                kind: cwiczenie.kind,
                group: e?.muscle_group ?? "",
                equipment: e?.equipment ?? "",
              });
            }}
          />
        ))}

        <div className="flex gap-2 max-[799px]:flex-col">
          <Button className="h-10 flex-1 justify-center max-[799px]:h-11 max-[799px]:flex-none" onClick={() => setWybor(true)}>
            <Plus size={16} aria-hidden="true" />
            Dodaj ćwiczenie
          </Button>
          {trwa && (
            <Button variant="ghost" className="text-destructive-foreground max-[799px]:h-11" onClick={() => setOkno("odrzuc")}>
              Odrzuć trening
            </Button>
          )}
          {!edycja && !trwa && (
            <Button variant="ghost" asChild className="max-[799px]:h-11">
              <Link href={powrot}>Anuluj</Link>
            </Button>
          )}
        </div>
        <p className="m-0 text-xs text-muted-foreground">
          „Poprzednio” to ta sama seria z ostatniego treningu — kliknij, żeby ją skopiować. Odhaczenie serii uruchamia przerwę.
        </p>
      </div>

      {przerwa && <RestBar rest={przerwa} onChange={setPrzerwa} onClose={zamknijPrzerwe} />}
      <ExercisePickDialog
        open={wybor}
        exercises={data.exercises}
        inWorkout={sklep.exercises.map((e) => e.name)}
        history={data.history}
        sessionId={session.id}
        selected={zaznaczone}
        onSelect={setZaznaczone}
        onClose={() => setWybor(false)}
        onAdd={(nazwy) => void dodaj(nazwy)}
        onNew={(name, group) => setFormularz({ name, kind: "wr", group: group.toLowerCase(), equipment: "Brak / inne" })}
      />
      {formularz && (
        <ExerciseFormDialog
          initial={formularz}
          takenNames={data.exercises.map((e) => e.name)}
          kindWarning={serie.some((s) => s.exercise_id === formularz.id && (s.reps !== null || s.weight_kg !== null || s.duration_s !== null || s.distance_km !== null))}
          onCancel={() => setFormularz(null)}
          onSave={zapiszCwiczenie}
        />
      )}
      {okno === "koniec" && (
        <FinishDialog
          title={`${session.title} · ${czas}`}
          stats={[
            ["Czas", czas],
            ["Objętość", `${formatVolume(sklep.volume)} kg`],
            ["Serie", `${sklep.doneCount} / ${sklep.totalCount}`],
          ]}
          records={rekordy.map((r) => r.tekst)}
          left={sklep.totalCount - sklep.doneCount}
          done={sklep.doneCount}
          canTemplate={session.template_id === null && sklep.exercises.length > 0}
          pending={czeka}
          onCancel={() => setOkno(null)}
          onFinish={(dane) => void zakoncz(dane)}
        />
      )}
      <ConfirmDialog
        open={okno === "odrzuc"}
        onOpenChange={(v) => !v && setOkno(null)}
        title="Odrzucić trening?"
        description="Wpisane serie i czas nie zostaną zapisane."
        confirmLabel="Odrzuć trening"
        cancelLabel="Wróć"
        pending={czeka}
        onConfirm={odrzuc}
      />
    </div>
  );
}

function ExerciseCard({
  data,
  store,
  exercise,
  record,
  onDone,
  onEdit,
}: {
  data: WorkoutData;
  store: GymStore;
  exercise: GymExercise;
  record: boolean;
  // Odhaczona seria — przerwa w sekundach
  onDone: (rest: number) => void;
  onEdit: () => void;
}) {
  const wiersz = data.exercises.find((e) => e.id === exercise.id);
  const [notatka, setNotatka] = useState(wiersz?.note ?? "");
  const [przerwa, setPrzerwa] = useState(wiersz?.rest_s ?? 90);
  const [menu, setMenu] = useState(false);
  const tymczasowe = isTempId(exercise.id);
  const naglowekId = `cwiczenie-${exercise.id}`;
  const rodzaj = EXERCISE_KINDS[exercise.kind];
  const poprzednie = previousSets(data.history, data.session.id, exercise.id);
  const planPowt = firstReps(data.templateItems.find((i) => i.exercise_id === exercise.id)?.reps_text ?? "");
  const etykiety = setLabels(exercise.sets);

  function zapisz(meta: { note?: string; rest_s?: number }) {
    updateExercise(exercise.id, meta).then(
      (w) => !w.ok && toast.error(w.message),
      () => toast.error(BLAD_ZAPISU),
    );
  }

  // Pole serii: szkic albo zapisana wartość, podpowiedź z poprzedniego treningu
  function pole(s: GymSetRow, field: DraftField, etykieta: string, p: GymSetRow | undefined) {
    const wartosc = {
      kg: s.weight_kg === null ? "" : formatKg(s.weight_kg),
      reps: s.reps === null ? "" : String(s.reps),
      time: s.duration_s === null ? "" : formatDuration(s.duration_s),
      km: s.distance_km === null ? "" : formatKg(s.distance_km),
    }[field];
    const podpowiedz = {
      kg: p?.weight_kg != null ? formatKg(p.weight_kg) : "",
      reps: p?.reps != null ? String(p.reps) : planPowt !== null ? String(planPowt) : "",
      time: p?.duration_s != null ? formatDuration(p.duration_s) : "0:30",
      km: p?.distance_km != null ? formatKg(p.distance_km) : "0,0",
    }[field];
    const nazwa = {
      kg: exercise.bodyweight ? "dociążenie (kg)" : "ciężar",
      reps: "powtórzenia",
      time: "czas",
      km: "dystans (km)",
    }[field];
    return (
      <input
        type="text"
        inputMode={field === "time" ? "text" : "decimal"}
        aria-label={`${etykieta} — ${nazwa}`}
        placeholder={podpowiedz}
        disabled={isTempId(s.id)}
        value={store.drafts.get(s.id)?.[field] ?? wartosc}
        onChange={(e) => store.setDraft(s.id, field, e.target.value)}
        onBlur={() => void store.commitDraft(s.id, field)}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className={cn(POLE, s.done && "border-transparent bg-transparent font-semibold")}
      />
    );
  }

  const polaA: DraftField | null = exercise.kind === "dist" ? "km" : rodzaj.a ? "kg" : null;
  const polaB: DraftField = exercise.kind === "dist" || exercise.kind === "dur" ? "time" : "reps";

  return (
    <section aria-labelledby={naglowekId} className="flex flex-col rounded-xl border border-border bg-white shadow-card">
      <div className="flex items-center gap-2 px-3 pt-3 min-[800px]:gap-3 min-[800px]:px-6 min-[800px]:pt-4">
        {tymczasowe ? (
          <span id={naglowekId} className="min-w-0 truncate text-base font-semibold">
            {exercise.name}
          </span>
        ) : (
          <Link id={naglowekId} href={`/sport/cwiczenia/${exercise.id}`} className="min-w-0 truncate text-base font-semibold text-foreground no-underline outline-none focus-visible:shadow-focus">
            {exercise.name}
          </Link>
        )}
        {exercise.kind !== "wr" && (
          <StatusBadge tone="gray" className="max-[799px]:hidden">
            {rodzaj.label}
          </StatusBadge>
        )}
        {record && <StatusBadge tone="green">nowy rekord</StatusBadge>}
        <span className="ml-auto text-xs whitespace-nowrap text-muted-foreground tabular-nums max-[799px]:hidden">
          {`${exercise.sets.filter((s) => s.done).length} / ${exercise.sets.length} serii`}
        </span>
        <ActionPopover
          open={menu}
          onOpenChange={setMenu}
          align="end"
          width={200}
          className="p-1"
          ariaLabel={`Więcej: ${exercise.name}`}
          trigger={
            <Button variant="ghost" size="sm" icon aria-label={`Więcej: ${exercise.name}`} disabled={tymczasowe} className="max-[799px]:ml-auto max-[799px]:size-9">
              <MoreHorizontal size={16} aria-hidden="true" />
            </Button>
          }
        >
          <button
            type="button"
            className={MENU_ITEM}
            onClick={() => {
              setMenu(false);
              onEdit();
            }}
          >
            Edytuj ćwiczenie
          </button>
          <div className={MENU_SEPARATOR} />
          <button
            type="button"
            className={cn(MENU_ITEM, MENU_ITEM_DANGER)}
            onClick={() => {
              setMenu(false);
              void store.removeExercise(exercise.id);
            }}
          >
            Usuń z treningu
          </button>
        </ActionPopover>
      </div>
      <div className="flex items-center gap-2 px-3 pt-1 pb-3 min-[800px]:px-6">
        <input
          type="text"
          aria-label={`Notatka: ${exercise.name}`}
          placeholder="Dodaj notatkę…"
          maxLength={500}
          disabled={tymczasowe}
          value={notatka}
          onChange={(e) => setNotatka(e.target.value)}
          onBlur={() => {
            if (notatka !== (wiersz?.note ?? "")) zapisz({ note: notatka });
          }}
          className="min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-soft-foreground outline-none placeholder:text-faint-foreground"
        />
        <button
          type="button"
          disabled={tymczasowe}
          aria-label={`Przerwa po serii ${formatDuration(przerwa)} — zmień`}
          onClick={() => {
            const nowa = PRZERWY[(PRZERWY.indexOf(przerwa) + 1) % PRZERWY.length];
            setPrzerwa(nowa);
            zapisz({ rest_s: nowa });
          }}
          className="inline-flex h-[30px] flex-none items-center gap-1.5 rounded-full border border-border bg-white px-2.5 text-xs font-medium text-soft-foreground tabular-nums outline-none focus-visible:shadow-focus min-[800px]:h-[26px]"
        >
          <Timer size={13} aria-hidden="true" />
          <span className="max-[799px]:hidden">Przerwa</span>
          {formatDuration(przerwa)}
        </button>
      </div>
      <div className={cn(KOLUMNY, "pb-1.5 text-[11px] font-semibold tracking-[.04em] text-muted-foreground uppercase")}>
        <span>Seria</span>
        <span>Poprzednio</span>
        <span className="text-center">{rodzaj.a}</span>
        <span className="text-center">{rodzaj.b}</span>
        <span className="text-center">✓</span>
        <span className="max-[799px]:hidden" />
      </div>
      {exercise.sets.map((s, j) => {
        const nrSerii = etykiety[j];
        const etykieta = `${exercise.name}, seria ${nrSerii}`;
        const p = poprzednie[j];
        const poprzednio = p ? formatSet(p, exercise.kind) : null;
        const kopia: SetPatch = p
          ? { weight_kg: p.weight_kg, reps: p.reps, duration_s: p.duration_s, distance_km: p.distance_km }
          : {};
        const pusta =
          s.reps === null && s.weight_kg === null && s.duration_s === null && s.distance_km === null && !store.drafts.has(s.id);
        const typ = SET_TYPES.findIndex((t) => t.value === s.set_type);
        const ciezar = effectiveKg(s.weight_kg, exercise.bodyweight, data.profile.weightKg);
        return (
          <div
            key={s.id}
            data-testid={`seria-${exercise.name}-${j + 1}`}
            data-done={s.done}
            data-kg={ciezar ?? undefined}
            className={cn(KOLUMNY, "group border-t border-black/5 py-1.5", s.done && "bg-success/[.06]")}
          >
            <button
              type="button"
              disabled={isTempId(s.id)}
              aria-label={`${etykieta} — typ: ${SET_TYPES[typ]?.name ?? "robocza"}, zmień`}
              onClick={() => void store.update(s.id, { set_type: SET_TYPES[(typ + 1) % SET_TYPES.length].value })}
              className={cn("size-[30px] rounded-lg border-0 bg-black/[.04] text-[13px] font-semibold tabular-nums outline-none focus-visible:shadow-focus", KOLOR_TYPU[s.set_type])}
            >
              {nrSerii}
            </button>
            <button
              type="button"
              disabled={!poprzednio || isTempId(s.id)}
              aria-label={poprzednio ? `Wpisz poprzedni wynik ${poprzednio} do: ${etykieta}` : `${etykieta} — brak poprzedniego wyniku`}
              onClick={() => void store.update(s.id, kopia)}
              className="min-w-0 truncate border-0 bg-transparent p-0 text-left text-[13px] text-muted-foreground tabular-nums outline-none enabled:hover:text-foreground enabled:hover:underline focus-visible:shadow-focus"
            >
              {poprzednio ?? "—"}
            </button>
            {polaA ? pole(s, polaA, etykieta, p) : <span />}
            {pole(s, polaB, etykieta, p)}
            <button
              type="button"
              disabled={isTempId(s.id)}
              aria-pressed={s.done}
              aria-label={`${etykieta} zrobiona`}
              onClick={() => {
                if (!s.done) onDone(przerwa);
                void store.toggleDone(s.id, pusta ? kopia : {});
              }}
              className={cn(
                "grid h-9 w-full place-items-center justify-self-center rounded-lg border border-black/[.12] bg-white p-0 text-[#a3a3a3] outline-none focus-visible:shadow-focus min-[800px]:size-8",
                s.done && "border-success bg-success text-white",
              )}
            >
              <Check size={16} strokeWidth={2.5} aria-hidden="true" />
            </button>
            <Button
              variant="ghost"
              size="xs"
              icon
              aria-label={`Usuń ${etykieta}`}
              disabled={isTempId(s.id)}
              onClick={() => void store.deleteSet(s.id)}
              className="text-faint-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100 max-[799px]:hidden"
            >
              <X size={14} aria-hidden="true" />
            </Button>
          </div>
        );
      })}
      {exercise.bodyweight && data.profile.weightKg === null && (
        <div className="px-3 pt-1.5 text-xs text-muted-foreground min-[800px]:px-6">
          Uzupełnij wagę w profilu (
          <Link href="/ustawienia/ogolne" className="text-foreground underline">
            Ustawienia → Profil
          </Link>
          ), żeby liczyć objętość i rekordy.
        </div>
      )}
      <div className="px-3 pt-2 pb-3 min-[800px]:px-6 min-[800px]:pb-4">
        <Button size="sm" disabled={tymczasowe} onClick={() => void store.addSet(exercise.id)} className="w-full justify-center max-[799px]:h-10">
          <Plus size={14} aria-hidden="true" />
          Dodaj serię
        </Button>
      </div>
    </section>
  );
}
