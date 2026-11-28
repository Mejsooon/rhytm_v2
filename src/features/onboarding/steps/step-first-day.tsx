"use client";

// Krok 3: „Zaplanuj dzisiaj” — podpowiedzi, godziny do poprawienia i własny blok (S2OnboardingFlow).
import * as React from "react";
import { X } from "lucide-react";

import { Button, FIELD } from "@/components/controls";
import { cn } from "@/lib/utils";
import {
  blockValid,
  categoriesForUses,
  CATEGORY_COLORS,
  suggestions,
  type DraftBlock,
  type OnboardingDraft,
} from "../model";
import { StepHeader } from "./step-header";

const MAKS_BLOKOW = 12;

const Kropka = ({ kolor }: { kolor: string }) => (
  <span aria-hidden="true" className="inline-block size-2 flex-none rounded-full" style={{ background: kolor }} />
);

export function StepFirstDay({
  draft,
  onChange,
}: {
  draft: OnboardingDraft;
  onChange: (next: OnboardingDraft) => void;
}) {
  const [wlasny, setWlasny] = React.useState("");
  const { blocks } = draft;
  const podpowiedzi = suggestions(draft.uses, blocks);
  const pelno = blocks.length >= MAKS_BLOKOW;

  const dodaj = (b: DraftBlock) => {
    if (!pelno) onChange({ ...draft, blocks: [...blocks, b] });
  };
  const zmien = (i: number, zmiana: Partial<DraftBlock>) =>
    onChange({ ...draft, blocks: blocks.map((b, j) => (j === i ? { ...b, ...zmiana } : b)) });

  function dodajWlasny() {
    const title = wlasny.trim();
    if (!title) return;
    dodaj({ title, start: "20:30", end: "21:30", category: categoriesForUses(draft.uses)[0].name });
    setWlasny("");
  }

  return (
    <>
      <StepHeader
        title="Zaplanuj dzisiaj"
        subtitle="Dodaj 2–3 bloki na dziś. Tak działa rhytm: dzień ułożony z bloków, a zadania w środku."
      />

      <div>
        <div className="mb-2 text-xs font-semibold tracking-[0.04em] text-muted-foreground uppercase">Podpowiedzi</div>
        <div className="flex flex-wrap gap-2">
          {podpowiedzi.map((p) => (
            <button
              key={p.title}
              type="button"
              disabled={pelno}
              onClick={() => dodaj(p)}
              className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-border-strong bg-white px-3 text-[13px] text-soft-foreground outline-none hover:border-solid hover:bg-panel focus-visible:shadow-focus max-[799px]:h-11"
            >
              <Kropka kolor={CATEGORY_COLORS[p.category]} />
              {p.title} · {p.start}
            </button>
          ))}
          {podpowiedzi.length === 0 && (
            <span className="text-xs text-muted-foreground">Wszystkie podpowiedzi dodane.</span>
          )}
        </div>
      </div>

      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {blocks.map((b, i) => (
          <li key={`${i}|${b.title}`} className="flex flex-wrap items-center gap-2 rounded-[10px] border border-border px-2.5 py-2">
            <Kropka kolor={CATEGORY_COLORS[b.category]} />
            {(["start", "end"] as const).map((pole) => (
              <input
                key={pole}
                value={b[pole]}
                disabled={b.saved}
                aria-label={`${b.title} — ${pole === "start" ? "początek" : "koniec"}`}
                aria-invalid={(!b.saved && !blockValid(b)) || undefined}
                onChange={(e) => zmien(i, { [pole]: e.target.value })}
                className={cn(FIELD, "w-16 px-1 text-center tabular-nums")}
              />
            ))}
            <span className="min-w-0 flex-1 truncate">{b.title}</span>
            {b.saved ? (
              <span className="text-xs text-muted-foreground">w kalendarzu</span>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                icon
                aria-label={`Usuń ${b.title}`}
                onClick={() => onChange({ ...draft, blocks: blocks.filter((_, j) => j !== i) })}
              >
                <X aria-hidden="true" className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
        {blocks.length === 0 && (
          <li className="text-xs text-muted-foreground">Kliknij podpowiedź albo wpisz własny blok poniżej.</li>
        )}
      </ul>
      {blocks.some((b) => !b.saved && !blockValid(b)) && (
        <p role="alert" className="m-0 text-[13px] text-destructive-foreground">
          Godziny w formacie 08:00, a koniec po początku.
        </p>
      )}

      <div className="flex gap-2">
        <input
          value={wlasny}
          maxLength={120}
          aria-label="Własny blok"
          placeholder="Własny blok, np. Nauka angielskiego"
          onChange={(e) => setWlasny(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              dodajWlasny();
            }
          }}
          className={cn(FIELD, "flex-1")}
        />
        <Button disabled={!wlasny.trim() || pelno} onClick={dodajWlasny}>
          Dodaj
        </Button>
      </div>
    </>
  );
}
