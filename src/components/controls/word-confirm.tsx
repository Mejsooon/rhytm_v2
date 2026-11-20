"use client";

import * as React from "react";

import { Button } from "./button";
import { matchesWord } from "./match-word";

// Potwierdzenie słowem wg VaultReset.dc.html: przycisk nieaktywny (aria-disabled, bez reakcji
// na klik), dopóki wpisane słowo się nie zgadza.
export function WordConfirm({
  word,
  label,
  confirmLabel,
  onConfirm,
  destructive = false,
}: {
  word: string;
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  const [wpisane, setWpisane] = React.useState("");
  const zgodne = matchesWord(wpisane, word);

  // Słowo w etykiecie wyróżnione jak w makiecie (mono, szare tło, ramka)
  const czesci = label.split(word);

  return (
    <div className="flex flex-col gap-3.5">
      <label className="flex flex-col gap-1.5 text-[13px] font-medium">
        <span>
          {czesci.map((czesc, i) => (
            <React.Fragment key={i}>
              {i > 0 && (
                <span className="rounded-[4px] border border-input bg-muted px-[5px] font-mono">
                  {word}
                </span>
              )}
              {czesc}
            </React.Fragment>
          ))}
        </span>
        <input
          type="text"
          value={wpisane}
          onChange={(e) => setWpisane(e.target.value)}
          placeholder={word}
          autoComplete="off"
          className="w-full rounded-md border border-input bg-white px-2.5 py-2 font-mono text-sm font-normal text-foreground outline-none placeholder:text-faint-foreground focus:border-primary max-[799px]:h-12 max-[799px]:rounded-md max-[799px]:px-3.5 max-[799px]:py-0"
        />
      </label>
      <div className="flex justify-end">
        <Button
          variant={destructive ? "destructive" : "primary"}
          aria-disabled={!zgodne}
          className={zgodne ? undefined : "cursor-not-allowed opacity-40"}
          onClick={() => {
            if (zgodne) onConfirm();
          }}
        >
          {confirmLabel}
        </Button>
      </div>
    </div>
  );
}
