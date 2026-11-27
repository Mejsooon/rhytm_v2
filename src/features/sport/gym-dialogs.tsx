"use client";

// Okna dziennika siłowni (S2GymLog / CMGym): dodawanie ćwiczeń, własne ćwiczenie, zakończenie treningu
// i pływający pasek przerwy. Okna to FormDialog (na telefonie arkusz od dołu).
import { useEffect, useState, type ReactNode } from "react";
import { Check, Plus, Search, Timer } from "lucide-react";

import { Button, Chip, FIELD, FormDialog, StatusBadge, TextField } from "@/components/controls";
import { cn } from "@/lib/utils";
import type { ExerciseInput } from "./actions";
import { EXERCISE_LIBRARY } from "./library";
import {
  EXERCISE_KINDS,
  formatDuration,
  formatSet,
  kindOf,
  plPlural,
  previousSets,
  type ExerciseKind,
  type ExerciseRow,
  type HistorySession,
} from "./model";

export const PARTIE = ["Klatka", "Plecy", "Barki", "Ramiona", "Nogi", "Brzuch", "Inne"];
const SPRZET = ["Sztanga", "Hantle", "Kettlebell", "Wyciąg", "Maszyna", "Masa ciała", "Guma", "Brak / inne"];

// Grupa z bazy („triceps”, „pośladki”…) → partia z chipów makiety
export function partia(group: string | null): string {
  const g = (group ?? "").toLowerCase();
  if (g === "triceps" || g === "biceps") return "Ramiona";
  if (g === "pośladki") return "Nogi";
  return PARTIE.find((p) => p.toLowerCase() === g) ?? "Inne";
}

type Pozycja = { id: string | null; name: string; group: string; equipment: string; kind: ExerciseKind };

// Ćwiczenia użytkownika i biblioteki (bez duplikatów nazw)
export function exerciseCatalog(own: ExerciseRow[]): Pozycja[] {
  const wynik: Pozycja[] = own.map((e) => {
    const zBiblioteki = EXERCISE_LIBRARY.find((l) => l.name.toLowerCase() === e.name.toLowerCase());
    return {
      id: e.id,
      name: e.name,
      group: partia(e.muscle_group),
      equipment: e.equipment ?? zBiblioteki?.equipment ?? "Brak / inne",
      kind: kindOf(e),
    };
  });
  const sa = new Set(own.map((e) => e.name.toLowerCase()));
  for (const l of EXERCISE_LIBRARY) {
    if (!sa.has(l.name.toLowerCase()))
      wynik.push({ id: null, name: l.name, group: partia(l.group), equipment: l.equipment, kind: l.kind });
  }
  return wynik.sort((a, b) => a.name.localeCompare(b.name, "pl"));
}

const inicjaly = (nazwa: string) =>
  nazwa.split(" ").filter((s) => s.length > 2).slice(0, 2).map((s) => s[0]).join("").toUpperCase();

export function ExercisePickDialog({
  open,
  exercises,
  inWorkout,
  history,
  sessionId,
  onClose,
  onAdd,
  onNew,
  selected,
  onSelect,
}: {
  open: boolean;
  exercises: ExerciseRow[];
  inWorkout: string[];
  history: HistorySession[];
  sessionId: string;
  onClose: () => void;
  onAdd: (names: string[]) => void;
  // „Własne ćwiczenie” / „Utwórz „…”” — otwiera formularz z tą nazwą i partią
  onNew: (name: string, group: string) => void;
  selected: string[];
  onSelect: (names: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [filtr, setFiltr] = useState("Wszystkie");
  const szukane = q.trim().toLowerCase();
  const nazwa = q.trim() ? q.trim()[0].toUpperCase() + q.trim().slice(1) : "";
  const wTreningu = new Set(inWorkout.map((n) => n.toLowerCase()));
  const lista = exerciseCatalog(exercises).filter(
    (p) => (filtr === "Wszystkie" || p.group === filtr) && p.name.toLowerCase().includes(szukane),
  );
  const nowe = () => onNew(nazwa, filtr === "Wszystkie" ? "Inne" : filtr);

  function zamknij() {
    setQ("");
    setFiltr("Wszystkie");
    onClose();
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(v) => !v && zamknij()}
      title="Dodaj ćwiczenie"
      wide
      contentClassName="max-[799px]:h-[88%]"
      footerClassName="justify-between"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={nowe}>
            <Plus size={14} aria-hidden="true" />
            Własne ćwiczenie
          </Button>
          <span className="flex gap-2">
            <Button variant="ghost" onClick={zamknij}>
              Anuluj
            </Button>
            <Button
              variant="primary"
              disabled={selected.length === 0}
              onClick={() => {
                onAdd(selected);
                zamknij();
              }}
            >
              {selected.length > 1
                ? `Dodaj ${plPlural(selected.length, "ćwiczenie", "ćwiczenia", "ćwiczeń")}`
                : "Dodaj ćwiczenie"}
            </Button>
          </span>
        </>
      }
    >
      <label className={cn(FIELD, "flex h-9 flex-none items-center gap-2 max-[799px]:h-11")}>
        <Search size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj ćwiczenia…"
          aria-label="Szukaj ćwiczenia"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm outline-none max-[799px]:text-base"
        />
      </label>
      <div role="group" aria-label="Partia mięśni" className="flex flex-none gap-1.5 overflow-x-auto">
        {["Wszystkie", ...PARTIE.slice(0, -1)].map((p) => (
          <Chip key={p} variant="solid" selected={filtr === p} onClick={() => setFiltr(p)}>
            {p}
          </Chip>
        ))}
      </div>
      <div className="-mx-6 flex min-h-[300px] flex-col overflow-y-auto border-t border-border max-[799px]:-mx-5">
        {lista.map((p) => {
          const jest = wTreningu.has(p.name.toLowerCase());
          const zaznaczone = selected.includes(p.name);
          const ostatnie = p.id ? previousSets(history, sessionId, p.id) : [];
          const wynik = ostatnie.length ? formatSet(ostatnie[ostatnie.length - 1], p.kind) : null;
          return (
            <button
              key={p.name}
              type="button"
              role="checkbox"
              aria-checked={zaznaczone}
              aria-disabled={jest}
              onClick={() => {
                if (!jest) onSelect(zaznaczone ? selected.filter((n) => n !== p.name) : [...selected, p.name]);
              }}
              className={cn(
                "flex min-h-12 w-full flex-none items-center gap-3 border-0 bg-transparent px-6 py-2 text-left outline-none hover:bg-black/[.03] focus-visible:bg-accent max-[799px]:px-5",
                zaznaczone && "bg-black/[.04]",
                jest && "cursor-default opacity-55",
              )}
            >
              <span aria-hidden="true" className="grid size-8 flex-none place-items-center rounded-[10px] bg-black/[.05] text-xs font-semibold text-soft-foreground">
                {inicjaly(p.name)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{p.name}</span>
                <span className="block truncate text-xs text-muted-foreground tabular-nums">
                  {`${p.group} · ${p.equipment}${p.kind === "wr" || p.kind === "bw" ? "" : ` · ${EXERCISE_KINDS[p.kind].label.toLowerCase()}`} · ${wynik ? `ostatnio ${wynik}` : "jeszcze nie robione"}`}
                </span>
              </span>
              {jest ? (
                <StatusBadge tone="gray">w treningu</StatusBadge>
              ) : (
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid size-[18px] flex-none place-items-center rounded-[5px] border-[1.5px] border-black/20 text-white",
                    zaznaczone && "border-primary bg-primary",
                  )}
                >
                  {zaznaczone && <Check size={12} strokeWidth={3} />}
                </span>
              )}
            </button>
          );
        })}
        {lista.length === 0 && (
          <div className="flex flex-col items-center gap-3 px-5 py-10 text-center">
            <span className="text-muted-foreground">{`Brak ćwiczeń pasujących do „${nazwa}”`}</span>
            <Button size="sm" onClick={nowe}>{`Utwórz „${nazwa}”`}</Button>
          </div>
        )}
      </div>
    </FormDialog>
  );
}

export function ExerciseFormDialog({
  initial,
  takenNames,
  kindWarning,
  onCancel,
  onSave,
}: {
  // id = edycja
  initial: ExerciseInput;
  takenNames: string[];
  // W treningu są wpisane serie tego ćwiczenia (zmiana rodzaju je wyczyści)
  kindWarning: boolean;
  onCancel: () => void;
  // false = zapis się nie udał, okno zostaje
  onSave: (input: ExerciseInput) => Promise<boolean>;
}) {
  const [f, setF] = useState(initial);
  const [zapisuje, setZapisuje] = useState(false);
  const nazwa = f.name.trim();
  const zajeta = takenNames.some((n) => n.toLowerCase() === nazwa.toLowerCase() && n.toLowerCase() !== initial.name.toLowerCase());
  const mozna = nazwa !== "" && !zajeta && !zapisuje;

  const grupaChipow = (etykieta: string, opcje: string[], wartosc: string, ustaw: (v: string) => void) => (
    <div role="group" aria-label={etykieta}>
      <div className="mb-1.5 text-[13px] font-medium">{etykieta}</div>
      <div className="flex flex-wrap gap-1.5">
        {opcje.map((o) => (
          <Chip key={o} variant="solid" selected={wartosc === o} onClick={() => ustaw(o)}>
            {o}
          </Chip>
        ))}
      </div>
    </div>
  );

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && !zapisuje && onCancel()}
      title={initial.id ? "Edytuj ćwiczenie" : "Nowe ćwiczenie"}
      wide
      footer={
        <>
          <Button variant="ghost" disabled={zapisuje} onClick={onCancel}>
            Anuluj
          </Button>
          <Button
            variant="primary"
            disabled={!mozna}
            onClick={async () => {
              setZapisuje(true);
              if (!(await onSave({ ...f, name: nazwa }))) setZapisuje(false);
            }}
          >
            {zajeta ? "Taka nazwa już istnieje" : initial.id ? "Zapisz zmiany" : "Utwórz ćwiczenie"}
          </Button>
        </>
      }
    >
      <TextField label="Nazwa" value={f.name} maxLength={60} placeholder="np. Rozciąganie" onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div>
        <div className="mb-1.5 text-[13px] font-medium">Rodzaj pomiaru</div>
        <div role="radiogroup" aria-label="Rodzaj pomiaru" className="flex flex-col gap-1.5">
          {(Object.keys(EXERCISE_KINDS) as ExerciseKind[]).map((k) => {
            const r = EXERCISE_KINDS[k];
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={f.kind === k}
                onClick={() => setF({ ...f, kind: k })}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[10px] border border-border bg-white px-3 py-2.5 text-left outline-none focus-visible:shadow-focus",
                  f.kind === k && "border-primary shadow-[inset_0_0_0_1px_var(--primary)]",
                )}
              >
                <span aria-hidden="true" className={cn("size-4 flex-none rounded-full border-[1.5px] border-black/25", f.kind === k && "border-[5px] border-primary")} />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{r.label}</span>
                  <span className="block text-xs text-muted-foreground">{r.hint}</span>
                </span>
                <StatusBadge tone="outline" className="tabular-nums">
                  {r.a ? `${r.a} · ${r.b}` : r.b}
                </StatusBadge>
              </button>
            );
          })}
        </div>
        {kindWarning && f.kind !== initial.kind && (
          <p className="mt-2 mb-0 text-xs text-[#b45309]">Zmiana rodzaju wyczyści serie wpisane w tym treningu.</p>
        )}
      </div>
      {grupaChipow("Partia mięśni", PARTIE, partia(f.group), (v) => setF({ ...f, group: v.toLowerCase() }))}
      {grupaChipow("Sprzęt", SPRZET, f.equipment, (v) => setF({ ...f, equipment: v }))}
    </FormDialog>
  );
}

const kolorTrudnosci = (n: number) => (n >= 8 ? "#ef4444" : n >= 5 ? "#f59e0b" : "#15803d");

export function FinishDialog({
  title,
  stats,
  records,
  left,
  done,
  canTemplate,
  pending,
  onCancel,
  onFinish,
}: {
  title: string;
  stats: [string, ReactNode][];
  // „Wyciskanie na ławce · 72,5 × 5”
  records: string[];
  left: number;
  done: number;
  canTemplate: boolean;
  pending: boolean;
  onCancel: () => void;
  onFinish: (dane: { difficulty: number | null; note: string; template: boolean }) => void;
}) {
  const [trudnosc, setTrudnosc] = useState<number | null>(null);
  const [notatka, setNotatka] = useState("");
  const [szablon, setSzablon] = useState(false);

  return (
    <FormDialog
      open
      onOpenChange={(v) => !v && !pending && onCancel()}
      title="Zakończyć trening?"
      description={title}
      footer={
        <>
          <Button variant="ghost" disabled={pending} onClick={onCancel}>
            Wróć do treningu
          </Button>
          <Button variant="primary" disabled={pending || done === 0} onClick={() => onFinish({ difficulty: trudnosc, note: notatka, template: szablon })}>
            Zapisz trening
          </Button>
        </>
      }
    >
      <div className="grid flex-none grid-cols-3 divide-x divide-border overflow-hidden rounded-[10px] border border-border">
        {stats.map(([k, v]) => (
          <div key={k} className="px-3.5 py-2.5">
            <div className="text-xs text-muted-foreground">{k}</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums">{v}</div>
          </div>
        ))}
      </div>
      {records.map((r) => (
        <div key={r} className="flex items-center gap-2">
          <StatusBadge tone="green">nowy rekord</StatusBadge>
          {r}
        </div>
      ))}
      {left > 0 && (
        <p className="m-0 text-xs text-[#b45309]">
          {`${plPlural(left, "nieodhaczona seria zostanie pominięta", "nieodhaczone serie zostaną pominięte", "nieodhaczonych serii zostanie pominiętych")}.`}
        </p>
      )}
      <div>
        <div className="mb-1.5 text-[13px] font-medium">
          Jak było? <span className="font-normal text-muted-foreground">trudność 1–10</span>
        </div>
        <div role="radiogroup" aria-label="Trudność" className="grid grid-cols-10 gap-1">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={trudnosc === n}
              onClick={() => setTrudnosc(trudnosc === n ? null : n)}
              className="h-8 rounded-[10px] border border-border bg-white p-0 text-[13px] font-medium tabular-nums outline-none focus-visible:shadow-focus"
              style={trudnosc === n ? { background: kolorTrudnosci(n), borderColor: kolorTrudnosci(n), color: "#fff" } : undefined}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
      <TextField label="Notatka (opcjonalnie)" value={notatka} maxLength={1000} placeholder="samopoczucie, co poprawić" onChange={(e) => setNotatka(e.target.value)} />
      {canTemplate && (
        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" checked={szablon} onChange={() => setSzablon(!szablon)} className="size-4 accent-primary" />
          Zapisz jako szablon
        </label>
      )}
    </FormDialog>
  );
}

export type Rest = { end: number; total: number };

// Pływający pasek przerwy; po zerze „Koniec przerwy” przez 5 s. Stan żyje tylko w przeglądarce.
export function RestBar({ rest, onChange, onClose }: { rest: Rest; onChange: (r: Rest) => void; onClose: () => void }) {
  const [teraz, setTeraz] = useState(() => Date.now());
  useEffect(() => {
    const zegar = setInterval(() => setTeraz(Date.now()), 500);
    return () => clearInterval(zegar);
  }, []);
  const zostalo = Math.ceil((rest.end - teraz) / 1000);
  useEffect(() => {
    if (zostalo <= -5) onClose();
  }, [zostalo, onClose]);
  const koniec = zostalo <= 0;
  const przesun = (s: number) =>
    onChange({ end: rest.end + s * 1000, total: Math.max(rest.total, zostalo + s) });
  const przycisk = "h-9 min-[800px]:h-7 flex-none rounded-lg border-0 bg-white/10 px-2.5 text-[13px] text-[#fafafa] outline-none focus-visible:shadow-focus";

  return (
    <div
      role="status"
      className="fixed inset-x-3 bottom-[88px] z-40 flex items-center gap-2.5 rounded-2xl bg-[#262626] py-2.5 pr-2.5 pl-4 text-[#fafafa] shadow-xl min-[800px]:inset-x-auto min-[800px]:bottom-6 min-[800px]:left-1/2 min-[800px]:-translate-x-1/2 min-[800px]:rounded-[14px]"
    >
      <Timer size={16} aria-hidden="true" className="flex-none" />
      <div className="min-w-0 flex-1 min-[800px]:flex min-[800px]:items-center min-[800px]:gap-3">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[13px] text-[#d4d4d4]">{koniec ? "Koniec przerwy — czas na serię" : "Przerwa"}</span>
          <b className="ml-auto text-lg font-semibold tabular-nums">{formatDuration(Math.max(0, zostalo))}</b>
        </div>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-white/15 min-[800px]:mt-0 min-[800px]:w-[120px]">
          <span
            className="block h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${(Math.max(0, zostalo) / rest.total) * 100}%`, background: koniec ? "#4ade80" : "#fafafa" }}
          />
        </span>
      </div>
      <button type="button" aria-label="Skróć przerwę o 15 s" onClick={() => przesun(-15)} className={przycisk}>
        −15 s
      </button>
      <button type="button" aria-label="Wydłuż przerwę o 15 s" onClick={() => przesun(15)} className={przycisk}>
        +15 s
      </button>
      <button type="button" onClick={onClose} className={cn(przycisk, "bg-[#fafafa] font-medium text-[#262626]")}>
        Pomiń
      </button>
    </div>
  );
}
