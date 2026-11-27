"use client";

// „+ Ćwiczenie” z dymkiem wyszukiwania (GymLog.dc.html): ćwiczenia użytkownika + biblioteka bez już
// dodanych, „+ Dodaj „…”” dla własnej nazwy, Enter wybiera pierwszy wynik, Esc zamyka.
import { useState } from "react";
import { PlusIcon, SearchIcon } from "lucide-react";

import {
  ActionPopover,
  Button,
  MENU_ITEM,
  MENU_SEPARATOR,
  StatusBadge,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { searchExercises } from "./library";
import type { ExerciseRow } from "./model";

// Pozycja listy jak .ddopt z makiety: nazwa po lewej, odznaka po prawej
const POZYCJA = cn(MENU_ITEM, "justify-between gap-2.5");

export function ExercisePicker({
  exercises,
  excludeNames,
  onPick,
  side = "top",
}: {
  exercises: ExerciseRow[];
  // Ćwiczenia już dodane do treningu
  excludeNames: string[];
  onPick: (name: string) => void;
  // Trening (GymLog) otwiera dymek w górę, edytor szablonu (WorkoutTemplates) w dół
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const wyniki = searchExercises(q, exercises, excludeNames);
  const ql = q.trim().toLowerCase();
  // „+ Dodaj „…”” tylko dla nazwy, której nie ma ani w ćwiczeniach użytkownika, ani w bibliotece, ani w treningu
  const wlasne =
    ql !== "" &&
    ![
      ...searchExercises("", exercises, []).map((w) => w.name),
      ...excludeNames,
    ].some((n) => n.toLowerCase() === ql);

  function wybierz(name: string) {
    setOpen(false);
    setQ("");
    onPick(name);
  }

  return (
    <ActionPopover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        setQ("");
      }}
      side={side}
      align="start"
      width={320}
      className="p-1"
      ariaLabel="Dodaj ćwiczenie"
      trigger={
        <Button aria-label="+ Ćwiczenie">
          <PlusIcon aria-hidden="true" className="size-4" />
          Ćwiczenie
        </Button>
      }
    >
      <div className="flex flex-col">
        {/* .igroup bez ramki, z linią pod spodem (CGymLog) */}
        <label className="mb-1 flex h-8 items-center gap-2 border-b border-border px-[11px] text-muted-foreground transition-colors focus-within:border-ring max-[799px]:h-11">
          <SearchIcon aria-hidden="true" className="size-4 flex-none" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const v = e.currentTarget.value.trim();
              const pierwszy = wyniki[0];
              if (
                pierwszy &&
                pierwszy.name.toLowerCase().includes(v.toLowerCase())
              )
                wybierz(pierwszy.name);
              else if (v) wybierz(v);
            }}
            placeholder="Szukaj albo wpisz własne…"
            aria-label="Szukaj ćwiczenia"
            className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-faint-foreground max-[799px]:text-[15px]"
          />
        </label>
        <div className="flex max-h-[260px] flex-col overflow-y-auto">
          {wyniki.map((w) => (
            <button
              key={w.name}
              type="button"
              className={POZYCJA}
              onClick={() => wybierz(w.name)}
            >
              <span>{w.name}</span>
              {w.group && <StatusBadge tone="gray">{w.group}</StatusBadge>}
            </button>
          ))}
          {wlasne && (
            <>
              <div className={MENU_SEPARATOR} />
              <button
                type="button"
                className={POZYCJA}
                onClick={() => wybierz(q.trim())}
              >
                <span>{`+ Dodaj „${q.trim()}”`}</span>
                <StatusBadge tone="outline">własne</StatusBadge>
              </button>
            </>
          )}
        </div>
      </div>
    </ActionPopover>
  );
}
