"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Segment wg BlockDialog.dc.html (web: przyciski w ramce, wybrany #f0f0f0)
// i MBlockSheet.dc.html (telefon: szare tło, wybrana biała pigułka z cieniem).
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
      className="flex w-max max-w-full overflow-hidden rounded-md border border-input text-[13px] max-[799px]:grid max-[799px]:w-full max-[799px]:auto-cols-fr max-[799px]:grid-flow-col max-[799px]:gap-[3px] max-[799px]:rounded-md max-[799px]:border-0 max-[799px]:bg-muted max-[799px]:p-[3px]"
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
              "flex cursor-pointer items-center justify-center border-0 px-3 py-1.5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/20 max-[799px]:h-[34px] max-[799px]:rounded-lg max-[799px]:border-l-0 max-[799px]:px-2 max-[799px]:py-0",
              i > 0 && "border-l border-input",
              wybrany
                ? "bg-active font-medium text-foreground max-[799px]:bg-white max-[799px]:shadow-[0_1px_2px_rgba(0,0,0,.08)]"
                : "bg-white text-muted-foreground max-[799px]:bg-transparent max-[799px]:text-soft-foreground",
            )}
          >
            {opcja.label}
          </button>
        );
      })}
    </div>
  );
}
