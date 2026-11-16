"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { ChevronDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { StatusBadge, type BadgeTone } from "./status-badge";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  badge?: { label: string; tone: BadgeTone };
};

// Lista rozwijana wg .dd / .ddpop / .ddopt z Settings.dc.html. Lista w portalu (nie ginie
// w rodzicu z overflow: hidden); klawiatura: ↑/↓ przesuwa, Enter wybiera, Esc zamyka.
export function Dropdown<T extends string>({
  value,
  onChange,
  options,
  placeholder = "Wybierz…",
  ariaLabel,
  width,
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  ariaLabel: string;
  width?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [aktywny, setAktywny] = React.useState(0);
  const lista = React.useRef<HTMLDivElement>(null);
  const idBazowe = React.useId();

  const wybrana = options.find((o) => o.value === value) ?? null;

  function zmienOtwarcie(nowe: boolean) {
    if (nowe) {
      // Aktywna na starcie: wybrana opcja (albo pierwsza)
      setAktywny(Math.max(0, options.findIndex((o) => o.value === value)));
    }
    setOpen(nowe);
  }

  function wybierz(indeks: number) {
    onChange(options[indeks].value);
    setOpen(false);
  }

  function naKlawisz(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktywny((i) => Math.min(options.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktywny((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setAktywny(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setAktywny(options.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      wybierz(aktywny);
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={zmienOtwarcie}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="listbox"
          style={width ? { width } : undefined}
          className={cn(
            "flex w-full cursor-pointer items-center justify-between gap-2 rounded-md border border-[#e0e0e0] bg-white px-2.5 py-2 text-left text-sm font-normal text-[#171717] outline-none hover:border-[#cfcfcf] max-[799px]:h-12 max-[799px]:rounded-[10px] max-[799px]:px-3.5 max-[799px]:py-0 max-[799px]:text-[15px]",
            open && "border-[#171717] hover:border-[#171717]",
          )}
        >
          {wybrana ? (
            wybrana.badge ? (
              <StatusBadge tone={wybrana.badge.tone}>{wybrana.badge.label}</StatusBadge>
            ) : (
              <span>{wybrana.label}</span>
            )
          ) : (
            <span className="text-[#a3a3a3]">{placeholder}</span>
          )}
          <ChevronDownIcon aria-hidden="true" className="size-3 flex-none text-[#666666]" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          avoidCollisions
          collisionPadding={8}
          // Fokus trafia na listę, żeby strzałki i Enter działały od razu
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            lista.current?.focus();
          }}
          style={{ width: width ?? "var(--radix-popover-trigger-width)" }}
          className="z-[70] rounded-[10px] border border-[#e0e0e0] bg-white p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.12),0_2px_6px_rgba(0,0,0,.06)] outline-none"
        >
          <div
            ref={lista}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            aria-activedescendant={`${idBazowe}-${aktywny}`}
            onKeyDown={naKlawisz}
            className="flex flex-col gap-px outline-none"
          >
            {options.map((opcja, i) => {
              const zaznaczona = opcja.value === value;
              return (
                <div
                  key={opcja.value}
                  id={`${idBazowe}-${i}`}
                  role="option"
                  aria-selected={zaznaczona}
                  onClick={() => wybierz(i)}
                  onMouseMove={() => setAktywny(i)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md px-2.5 py-[7px] text-left text-[13px] text-[#171717] max-[799px]:py-3 max-[799px]:text-[15px]",
                    i === aktywny && "bg-[#f5f5f5]",
                    zaznaczona && "bg-[#f0f0f0] font-medium",
                  )}
                >
                  {opcja.badge ? (
                    <StatusBadge tone={opcja.badge.tone}>{opcja.badge.label}</StatusBadge>
                  ) : (
                    <span>{opcja.label}</span>
                  )}
                  <span className="flex items-center gap-2">
                    {opcja.hint && (
                      <span className="font-mono text-xs font-normal text-[#6b6b6b]">
                        {opcja.hint}
                      </span>
                    )}
                    {zaznaczona && (
                      <span aria-hidden="true" className="text-[#15803d]">
                        ✓
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
