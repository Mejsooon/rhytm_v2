"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Segment wg .seg z coss.css: szare tło, wybrany przycisk to biała pigułka z cieniem.
// Przycisk 28 px, na telefonie 40 px, a kontener rozciąga się na całą szerokość.
export function Segment<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
  ariaLabel: string;
}) {
  const przyciski = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Strzałki zmieniają wybór i przenoszą fokus (roving tabindex jak w radiogroup)
  function naKlawisz(e: React.KeyboardEvent, indeks: number) {
    let cel = indeks;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      cel = (indeks + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      cel = (indeks - 1 + options.length) % options.length;
    } else {
      return;
    }
    e.preventDefault();
    onChange(options[cel].value);
    przyciski.current[cel]?.focus();
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex w-max max-w-full flex-wrap items-center gap-0.5 rounded-md bg-muted p-0.5 text-sm max-[799px]:grid max-[799px]:w-full max-[799px]:auto-cols-fr max-[799px]:grid-flow-col"
    >
      {options.map((opcja, i) => {
        const wybrany = opcja.value === value;
        return (
          <button
            key={opcja.value}
            ref={(el) => {
              przyciski.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={wybrany}
            tabIndex={wybrany ? 0 : -1}
            onClick={() => onChange(opcja.value)}
            onKeyDown={(e) => naKlawisz(e, i)}
            className={cn(
              "inline-flex h-7 cursor-pointer items-center justify-center rounded-[8px] border-0 px-2.5 font-medium whitespace-nowrap transition-[box-shadow,background-color,color] duration-150 outline-none focus-visible:shadow-focus max-[799px]:h-10 max-[799px]:px-2",
              wybrany
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_1px_rgba(0,0,0,.05)]"
                : "bg-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {opcja.label}
          </button>
        );
      })}
    </div>
  );
}
