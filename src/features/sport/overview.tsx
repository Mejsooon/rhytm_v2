"use client";

// Zakładka „Przegląd” Sportu (S2Sport): wykres okresu, aktywności tygodniami z rozwijanymi szczegółami,
// „Ten tydzień” (klik w dzień rozwija aktywność) i klikalne „Rekordy”.
import Link from "next/link";
import { useState } from "react";
import { Activity, ChevronRight, Dumbbell, Footprints } from "lucide-react";

import { Button, Card, Progress, StatusBadge } from "@/components/controls";
import type { IsoDate } from "@/components/controls/calendar-math";
import { addDays, isoWeekNumber, weekdayOf } from "@/features/calendar/view-range";
import { cn } from "@/lib/utils";
import type { SessionSets, SportProfile, TemplateWithItems } from "./load-sport";
import {
  epley1rm,
  formatDuration,
  formatKm,
  formatPace,
  formatVolume,
  plPlural,
  sessionVolume,
  type ExerciseRow,
  type SportItem,
} from "./model";
import { OverviewChart } from "./overview-chart";
import { periodRange, runRecords, stats, weekStartOf, wZakresie, type Filtr, type Okres, type Rekord } from "./overview-model";

const DNI = ["", "pon", "wt", "śr", "czw", "pt", "sob", "nd"];
const KOLOR = { run: "#c2410c", gym: "#404040", other: "#7c3aed" };
const godzina = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const kiedy = (d: IsoDate) => `${DNI[weekdayOf(d)]} ${d.slice(8, 10)}.${d.slice(5, 7)}`;
const liczba = (n: number) => n.toLocaleString("pl-PL", { maximumFractionDigits: 1 });
const kolorWpisu = (i: SportItem) => (i.kind === "other" ? (i.color ?? KOLOR.other) : KOLOR[i.kind]);

function Ikona({ item }: { item: SportItem }) {
  const Znak = item.kind === "run" ? Footprints : item.kind === "gym" ? Dumbbell : Activity;
  const kolor = kolorWpisu(item);
  return (
    <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[10px]" style={{ background: `${kolor}14`, color: kolor }}>
      <Znak size={16} />
    </span>
  );
}

export function SportOverview({
  items,
  filtr,
  today,
  initialDate,
  profile,
  exercises,
  setsHistory,
  templates,
  onOpen,
  onDelete,
  onReschedule,
  onResetFilter,
}: {
  // Wszystkie sesje i zaplanowane wystąpienia szablonów
  items: SportItem[];
  filtr: Filtr;
  today: IsoDate;
  initialDate: IsoDate;
  profile: SportProfile;
  exercises: ExerciseRow[];
  setsHistory: SessionSets[];
  // Klik w aktywność (edycja, uzupełnienie albo rozpoczęcie treningu)
  onOpen: (item: SportItem) => void;
  templates: TemplateWithItems[];
  onDelete: (item: SportItem) => void;
  // „Zmień termin” zaplanowanej siłowni
  onReschedule?: (item: SportItem) => void;
  // Klik w dzień „Tego tygodnia” wraca do filtra „Wszystko”, żeby aktywność była na liście
  onResetFilter: () => void;
}) {
  const [{ okres, kotwica }, setWidok] = useState<{ okres: Okres; kotwica: IsoDate }>({ okres: "miesiac", kotwica: initialDate });
  // Rozwinięta aktywność (klucz)
  const [otwarta, setOtwarta] = useState<string | null>(null);
  const zakres = periodRange(okres, kotwica, profile.weekStart);
  const widoczne = filtr === "all" ? items : items.filter((i) => i.kind === filtr);
  const wOkresie = wZakresie(widoczne, zakres.from, zakres.to);
  // Lista: wykonane z okresu i plany od dziś, pogrupowane tygodniami od najnowszych
  const lista = wOkresie
    .filter((i) => !i.planned || i.date >= today)
    .sort((a, b) => (a.date !== b.date ? (a.date > b.date ? -1 : 1) : b.startMin - a.startMin));
  const tygodnie = new Map<IsoDate, SportItem[]>();
  for (const i of lista) {
    const t = weekStartOf(i.date, profile.weekStart);
    tygodnie.set(t, [...(tygodnie.get(t) ?? []), i]);
  }

  const zMasaCiala = new Set(exercises.filter((e) => e.bodyweight).map((e) => e.id));
  const serieSesji = (i: SportItem) => setsHistory.find((x) => x.sessionId === i.sessionId)?.sets ?? [];
  function objetoscSesji(i: SportItem) {
    const serie = serieSesji(i);
    return { kg: sessionVolume(serie, zMasaCiala, profile.weightKg), sets: serie.length };
  }
  const nazwy = new Map(exercises.map((e) => [e.id, e.name]));

  // Rozwinięte szczegóły wiersza (S2Sport „adet”)
  function szczegoly(i: SportItem) {
    const dystans = i.distanceKm !== null ? `${formatKm(i.distanceKm)} km` : "—";
    const kcal = i.kcal !== null ? `≈ ${i.kcal}` : "—";
    const trudnosc = i.difficulty !== null ? `${i.difficulty}/10` : "—";
    const trwanie = i.durationS !== null ? formatDuration(i.durationS) : formatDuration(i.durationMin * 60);
    const szablon = i.templateId ? templates.find((t) => t.id === i.templateId) : undefined;
    let pola: [string, string][];
    let cwiczenia: { n: string; v: string }[] = [];
    let akcja: string;
    if (i.kind === "run") {
      pola = i.planned
        ? [["Plan", dystans], ["Start", godzina(i.startMin)], ["Kcal", "—"]]
        : [["Dystans", dystans], ["Czas", trwanie], ["Tempo", i.distanceKm && i.durationS ? `${formatPace(i.durationS / i.distanceKm)} /km` : "—"], ["Kcal", kcal]];
      akcja = i.planned ? "Uzupełnij dane" : "Edytuj bieg";
    } else if (i.kind === "other") {
      pola = i.planned
        ? [["Start", godzina(i.startMin)], ["Plan", dystans], ["Rodzaj", "inna aktywność"], ["Kcal", "—"]]
        : [["Czas", trwanie], i.distanceKm !== null ? ["Dystans", dystans] : ["Trudność", trudnosc], ["Kcal", kcal], ["Start", godzina(i.startMin)]];
      akcja = i.planned ? "Uzupełnij dane" : "Edytuj aktywność";
    } else {
      const serie = serieSesji(i);
      const ids = [...new Set(serie.map((x) => x.exercise_id))];
      cwiczenia = serie.length
        ? ids.map((id) => {
            const jej = serie.filter((x) => x.exercise_id === id && x.done);
            const naj = jej.sort((a, b) => (b.weight_kg ?? 0) - (a.weight_kg ?? 0) || (b.reps ?? 0) - (a.reps ?? 0))[0];
            return { n: nazwy.get(id) ?? "", v: i.planned || !naj ? "jak ostatnio" : `${naj.weight_kg !== null ? liczba(naj.weight_kg) : "mc"} × ${naj.reps ?? "—"}` };
          })
        : (szablon?.items ?? []).map((p) => ({ n: p.exerciseName, v: "jak ostatnio" }));
      pola = i.planned
        ? [["Szablon", szablon?.name ?? "—"], ["Start", godzina(i.startMin)], ["Ćwiczenia", String(cwiczenia.length)], ["Serie", String(serie.length || (szablon?.items.reduce((a, p) => a + p.sets_count, 0) ?? 0))]]
        : [["Objętość", `${formatVolume(objetoscSesji(i).kg)} kg`], ["Serie", plPlural(serie.length, "seria", "serie", "serii")], ["Czas", trwanie], ["Trudność", trudnosc]];
      akcja = i.planned ? "Rozpocznij trening" : "Otwórz trening";
    }
    return (
      <div data-testid="szczegoly" className="flex flex-col gap-3 border-t border-border bg-black/[.02] px-6 py-3.5 pl-[68px]">
        <div className="grid grid-cols-4 gap-3">
          {pola.map(([k, v]) => (
            <div key={k} className="min-w-0">
              <div className="text-[11px] text-muted-foreground">{k}</div>
              <div className="mt-0.5 truncate font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        {cwiczenia.length > 0 && (
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-[13px]">
            {cwiczenia.map((c) => (
              <div key={c.n} className="flex justify-between gap-3 border-b border-black/5 py-1">
                <span className="min-w-0 truncate">{c.n}</span>
                <span className="flex-none text-muted-foreground tabular-nums">{c.v}</span>
              </div>
            ))}
          </div>
        )}
        {i.note && <div className="text-[13px] text-soft-foreground">„{i.note}”</div>}
        <div className="flex items-center gap-2">
          <Button variant="primary" size="sm" onClick={() => onOpen(i)}>
            {akcja}
          </Button>
          {i.kind === "gym" && i.planned && onReschedule && (
            <Button size="sm" onClick={() => onReschedule(i)}>
              Zmień termin
            </Button>
          )}
          <Button variant="ghost" size="sm" className="text-destructive-foreground" onClick={() => onDelete(i)}>
            {i.planned && !i.sessionId ? "Pomiń" : "Usuń"}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground tabular-nums">
            {i.planned ? `w planie · ${godzina(i.startMin)}` : i.difficulty !== null ? `trudność ${trudnosc}` : ""}
          </span>
        </div>
      </div>
    );
  }

  function opis(i: SportItem): { wynik: string; srodek: string } {
    if (i.kind === "run") {
      return {
        wynik: i.distanceKm !== null ? `${formatKm(i.distanceKm)} km${i.planned ? " plan" : ""}` : "—",
        srodek: !i.planned && i.distanceKm && i.durationS ? `${formatPace(i.durationS / i.distanceKm)} /km` : "",
      };
    }
    if (i.kind === "other") {
      return {
        wynik: i.distanceKm !== null ? `${formatKm(i.distanceKm)} km${i.planned ? " plan" : ""}` : i.kcal !== null ? `≈ ${i.kcal} kcal` : "—",
        srodek: "",
      };
    }
    if (i.planned) return { wynik: i.templateId ? "z szablonu" : "—", srodek: "" };
    const serie = setsHistory.find((x) => x.sessionId === i.sessionId)?.sets ?? [];
    return { wynik: `${formatVolume(sessionVolume(serie, zMasaCiala, profile.weightKg))} kg`, srodek: `${serie.length} serii` };
  }

  // „Ten tydzień”: kółka dni, cel i najbliższy plan
  const poczatek = weekStartOf(today, profile.weekStart);
  const tydzien = wZakresie(items, poczatek, addDays(poczatek, 6));
  const st = stats(tydzien);
  const celKm = profile.kmGoalOn;
  const zrobione = celKm ? st.km : st.runs + st.gym + st.other;
  const celTygodnia = celKm ? profile.weeklyKmGoal : profile.workoutsGoalOn ? profile.weeklyWorkoutsGoal : null;
  const nastepny = items
    .filter((i) => i.planned && i.date >= today)
    .sort((a, b) => (a.date !== b.date ? (a.date < b.date ? -1 : 1) : a.startMin - b.startMin))[0];

  // Rekordy: biegi i trasy, potem dwa najwyższe szacowane 1RM
  const silowe: (Rekord & { kg: number })[] = [];
  for (const cw of exercises) {
    let naj: (Rekord & { kg: number }) | null = null;
    for (const sesja of setsHistory.filter((x) => x.completed)) {
      for (const seria of sesja.sets) {
        if (seria.exercise_id !== cw.id || !seria.done || !seria.weight_kg || !seria.reps || seria.set_type === "W" || seria.set_type === "D") continue;
        const kg = epley1rm(seria.weight_kg, seria.reps);
        if (!naj || kg > naj.kg) {
          naj = { key: cw.id, label: `${cw.name} · 1RM`, value: `${liczba(kg)} kg`, date: sesja.startLocal.slice(0, 10), kind: "gym", itemKey: `s:${sesja.sessionId}`, kg };
        }
      }
    }
    if (naj) silowe.push(naj);
  }
  const rekordy: Rekord[] = [...runRecords(items, formatDuration), ...silowe.sort((a, b) => b.kg - a.kg).slice(0, 2)].filter(
    (r) => filtr === "all" || r.kind === filtr,
  );
  const rekordoweKlucze = new Set(rekordy.map((r) => r.itemKey));

  return (
    <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] items-start gap-4">
      <div className="flex min-w-0 flex-col gap-4">
        <OverviewChart
          items={widoczne}
          filtr={filtr}
          today={today}
          okres={okres}
          kotwica={kotwica}
          onChange={(o, k) => setWidok({ okres: o, kotwica: k })}
          profile={profile}
          volume={objetoscSesji}
        />

        <Card className="overflow-hidden">
          <section aria-label="Aktywności">
            <div className="flex items-center justify-between px-6 py-4">
              <h2 className="m-0 text-base font-semibold">Aktywności</h2>
              <span className="text-xs text-muted-foreground tabular-nums">
                {`${lista.filter((i) => !i.planned).length} wykonanych · ${lista.filter((i) => i.planned).length} w planie`}
              </span>
            </div>
            <div className="grid grid-cols-[32px_minmax(0,1fr)_110px_90px_70px_16px] gap-3 px-6 pb-2 text-xs font-medium text-muted-foreground">
              <span />
              <span>Trening</span>
              <span className="text-right">Wynik</span>
              <span className="text-right">Tempo</span>
              <span className="text-right">Czas</span>
              <span />
            </div>
            {lista.length === 0 && <p className="m-0 border-t border-border px-6 py-4 text-muted-foreground">Brak aktywności w tym okresie.</p>}
            {[...tygodnie].map(([od, wpisy]) => {
              const w = stats(wpisy);
              return (
                <div key={od}>
                  <div className="flex justify-between border-t border-border bg-panel px-6 py-2 text-xs font-medium text-muted-foreground tabular-nums">
                    <span>{`Tydzień ${isoWeekNumber(addDays(od, 3))} · ${od.slice(8, 10)}.${od.slice(5, 7)}–${addDays(od, 6).slice(8, 10)}.${addDays(od, 6).slice(5, 7)}`}</span>
                    <span>{[w.km > 0 ? `${liczba(w.km)} km` : "", wpisy.some((i) => !i.planned) ? `${wpisy.filter((i) => !i.planned).length} tr.` : "", wpisy.some((i) => i.planned) ? `${wpisy.filter((i) => i.planned).length} w planie` : ""].filter(Boolean).join(" · ")}</span>
                  </div>
                  {wpisy.map((i) => {
                    const o = opis(i);
                    const rozwinieta = otwarta === i.key;
                    return (
                      <div key={i.key}>
                      <button
                        type="button"
                        aria-expanded={rozwinieta}
                        onClick={() => setOtwarta(rozwinieta ? null : i.key)}
                        className="grid w-full cursor-pointer grid-cols-[32px_minmax(0,1fr)_110px_90px_70px_16px] items-center gap-3 border-0 border-t border-solid border-border bg-transparent px-6 py-2.5 text-left text-sm text-foreground outline-none hover:bg-black/[.02] focus-visible:shadow-focus-inset"
                      >
                        <Ikona item={i} />
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate font-medium">{i.title}</span>
                            {i.planned && <StatusBadge tone="gray">zaplanowany</StatusBadge>}
                            {rekordoweKlucze.has(i.key) && <StatusBadge tone="green">rekord</StatusBadge>}
                          </span>
                          <span className="block text-xs text-muted-foreground tabular-nums">
                            {`${kiedy(i.date)} · ${godzina(i.startMin)}${i.difficulty !== null ? ` · trudność ${i.difficulty}/10` : ""}`}
                          </span>
                        </span>
                        <span className="text-right font-medium tabular-nums">{o.wynik}</span>
                        <span className="text-right text-muted-foreground tabular-nums">{o.srodek}</span>
                        <span className="text-right text-muted-foreground tabular-nums">
                          {!i.planned && (i.durationS !== null || i.kind === "gym") ? formatDuration(i.durationS ?? i.durationMin * 60) : ""}
                        </span>
                        <ChevronRight size={16} aria-hidden="true" className={cn("text-muted-foreground transition-transform", rozwinieta && "rotate-90")} />
                      </button>
                      {rozwinieta && szczegoly(i)}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </section>
        </Card>
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <Card className="p-6">
          <section aria-label="Ten tydzień" className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-base font-semibold">Ten tydzień</h2>
              <span className="text-xs text-muted-foreground tabular-nums">{`${poczatek.slice(8, 10)}.${poczatek.slice(5, 7)}–${addDays(poczatek, 6).slice(8, 10)}.${addDays(poczatek, 6).slice(5, 7)}`}</span>
            </div>
            <div className="grid grid-cols-7 text-center text-xs">
              {Array.from({ length: 7 }, (_, n) => {
                const d = addDays(poczatek, n);
                const dnia = tydzien.filter((i) => i.date === d);
                const wykonany = dnia.find((i) => !i.planned);
                const plan = dnia.find((i) => i.planned);
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={!wykonany && !plan}
                    aria-label={`${kiedy(d)}: ${(wykonany ?? plan)?.title ?? "odpoczynek"}`}
                    onClick={() => {
                      onResetFilter();
                      setWidok({ okres: "miesiac", kotwica: today });
                      setOtwarta((wykonany ?? plan)!.key);
                    }}
                    className="flex flex-col items-center gap-1 border-0 bg-transparent p-0 text-foreground outline-none enabled:cursor-pointer focus-visible:shadow-focus"
                  >
                    <span className="font-medium text-muted-foreground">{DNI[weekdayOf(d)]}</span>
                    <span
                      className={cn("grid size-8 place-items-center rounded-full bg-black/[.04] font-semibold tabular-nums", d === today && "ring-2 ring-primary")}
                      style={
                        wykonany
                          ? { background: kolorWpisu(wykonany), color: "#fff" }
                          : plan
                            ? { border: `1px dashed ${kolorWpisu(plan)}` }
                            : undefined
                      }
                    >
                      {Number(d.slice(8, 10))}
                    </span>
                  </button>
                );
              })}
            </div>
            {celTygodnia !== null && (
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted-foreground">Cel tygodnia</span>
                  <span className="tabular-nums">
                    <b>{liczba(zrobione)}</b> {`/ ${liczba(celTygodnia)} ${celKm ? "km" : "treningów"}`}
                  </span>
                </div>
                <Progress value={Math.min(zrobione, celTygodnia)} max={celTygodnia} ariaLabel="Cel tygodnia" />
              </div>
            )}
            {nastepny && (
              <div className="flex items-center gap-3 rounded-lg border border-dashed border-black/20 p-3">
                <Ikona item={nastepny} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{nastepny.title}</span>
                  <span className="text-xs text-muted-foreground">{`${nastepny.date === today ? "dziś" : kiedy(nastepny.date)} · ${godzina(nastepny.startMin)} · zaplanowany`}</span>
                </span>
                <Button size="sm" onClick={() => onOpen(nastepny)}>
                  {nastepny.kind === "gym" ? "Rozpocznij" : "Uzupełnij"}
                </Button>
              </div>
            )}
          </section>
        </Card>

        <Card className="p-6">
          <section aria-label="Rekordy">
            <div className="flex items-baseline justify-between pb-1">
              <h2 className="m-0 text-base font-semibold">Rekordy</h2>
              <span className="text-xs text-muted-foreground">najlepsze wyniki</span>
            </div>
            {rekordy.length === 0 && <p className="m-0 py-2 text-muted-foreground">Rekordy pojawią się po pierwszych treningach.</p>}
            {rekordy.map((r) => {
              const klasy = "flex w-full items-center gap-2.5 border-0 border-t border-solid border-border bg-transparent px-0 py-2.5 text-left text-sm text-foreground no-underline outline-none hover:bg-black/[.02] focus-visible:shadow-focus";
              const tresc = (
                <>
                  <span aria-hidden="true" className="size-2 flex-none rounded-full" style={{ background: KOLOR[r.kind] }} />
                  <span className="min-w-0 flex-1 truncate">{r.label}</span>
                  {/* „nowy”: rekord z ostatnich 14 dni */}
                  {r.date > addDays(today, -14) && <StatusBadge tone="green">nowy</StatusBadge>}
                  <span className="text-right">
                    <span className="block font-semibold tabular-nums">{r.value}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">{`${r.date.slice(8, 10)}.${r.date.slice(5, 7)}.${r.date.slice(0, 4)}`}</span>
                  </span>
                </>
              );
              if (r.kind === "gym") {
                return (
                  <Link key={r.key} href={`/sport/cwiczenia/${r.key}`} className={klasy}>
                    {tresc}
                  </Link>
                );
              }
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => {
                    const wpis = items.find((i) => i.key === r.itemKey);
                    if (wpis) onOpen(wpis);
                  }}
                  className={cn(klasy, "cursor-pointer")}
                >
                  {tresc}
                </button>
              );
            })}
          </section>
        </Card>
      </div>
    </div>
  );
}
