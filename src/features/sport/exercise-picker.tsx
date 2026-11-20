"use client";

// „+ Ćwiczenie” z dymkiem wyszukiwania (GymLog.dc.html): ćwiczenia użytkownika + biblioteka bez już
// dodanych, „+ Dodaj „…”” dla własnej nazwy, Enter wybiera pierwszy wynik, Esc zamyka.
import { useState, type ReactElement } from "react";

import { ActionPopover, Button } from "@/components/controls";
import { searchExercises } from "./library";
import type { ExerciseRow } from "./model";

const POZYCJA =
  "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-2 text-left text-[13px] text-foreground outline-none hover:bg-muted focus-visible:bg-muted max-[799px]:min-h-11 max-[799px]:text-sm";

export function ExercisePicker({
  exercises,
  excludeNames,
  onPick,
  side = "top",
  trigger = <Button size="sm">+ Ćwiczenie</Button>,
}: {
  exercises: ExerciseRow[];
  // Ćwiczenia już dodane do treningu
  excludeNames: string[];
  onPick: (name: string) => void;
  // Trening (GymLog) otwiera dymek w górę, edytor szablonu (WorkoutTemplates) w dół
  side?: "top" | "bottom";
  // Przycisk otwierający (telefon: „Dodaj ćwiczenie” z MGym); jeden element — Radix przejmuje klik
  trigger?: ReactElement;
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
      width={300}
      ariaLabel="Dodaj ćwiczenie"
      trigger={trigger}
    >
      <div className="flex flex-col gap-1.5">
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
          className="box-border w-full rounded-md border border-input bg-white px-2.5 py-2 text-sm max-[799px]:h-11 max-[799px]:text-[15px] text-foreground outline-none placeholder:text-faint-foreground focus:border-primary"
        />
        <div className="flex max-h-[260px] flex-col overflow-y-auto">
          {wyniki.map((w) => (
            <button
              key={w.name}
              type="button"
              className={POZYCJA}
              onClick={() => wybierz(w.name)}
            >
              <span>{w.name}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                {w.group ?? ""}
              </span>
            </button>
          ))}
          {wlasne && (
            <button
              type="button"
              className={`${POZYCJA} mt-1 pt-2.5`}
              style={{ borderTop: "1px solid #f0f0f0" }}
              onClick={() => wybierz(q.trim())}
            >
              <span>{`+ Dodaj „${q.trim()}”`}</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                własne
              </span>
            </button>
          )}
        </div>
      </div>
    </ActionPopover>
  );
}
