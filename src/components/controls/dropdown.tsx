"use client";

import * as React from "react";
import { Popover } from "radix-ui";
import { ChevronDownIcon, ChevronsUpDownIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { FIELD } from "./field";
import { StatusBadge, type BadgeTone } from "./status-badge";

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
  hint?: string;
  badge?: { label: string; tone: BadgeTone };
  // Własna zawartość opcji (np. plakietka w kolorze opcji pola strony) zamiast etykiety
  node?: React.ReactNode;
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
  compact = false,
  variant = "menu",
}: {
  value: T | null;
  onChange: (v: T) => void;
  options: DropdownOption<T>[];
  placeholder?: string;
  ariaLabel: string;
  width?: number;
  // Mały przycisk 28 px szerokości treści (btnBase z Books.dc.html, tryb edycji wiersza)
  compact?: boolean;
  // "select" = .dd z coss.css (pole formularza): ikona góra-dół i podpowiedź wybranej opcji w wyzwalaczu
  variant?: "menu" | "select";
}) {
  const [open, setOpen] = React.useState(false);
  const [aktywny, setAktywny] = React.useState(0);
  const lista = React.useRef<HTMLDivElement>(null);
  const idBazowe = React.useId();

  const wybrana = options.find((o) => o.value === value) ?? null;

  function zmienOtwarcie(nowe: boolean) {
    if (nowe) {
      // Aktywna na starcie: wybrana opcja (albo pierwsza)
      setAktywny(
        Math.max(
          0,
          options.findIndex((o) => o.value === value),
        ),
      );
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
          style={width && !compact ? { width } : undefined}
          className={cn(
            FIELD,
            "flex cursor-pointer items-center justify-between gap-2 text-left aria-expanded:border-ring aria-expanded:shadow-halo",
            compact && "inline-flex h-7 w-auto justify-start gap-1.5 px-2 text-xs whitespace-nowrap max-[799px]:h-7 max-[799px]:text-xs",
          )}
        >
          {wybrana ? (
            wybrana.node ? (
              wybrana.node
            ) : wybrana.badge ? (
              <StatusBadge tone={wybrana.badge.tone}>
                {wybrana.badge.label}
              </StatusBadge>
            ) : (
              <span>
                {wybrana.label}
                {variant === "select" && wybrana.hint && (
                  <>
                    {" "}
                    <span className="text-xs text-muted-foreground">
                      {wybrana.hint}
                    </span>
                  </>
                )}
              </span>
            )
          ) : (
            <span className="text-faint-foreground">{placeholder}</span>
          )}
          {variant === "select" ? (
            <ChevronsUpDownIcon
              aria-hidden="true"
              className="size-4 flex-none text-muted-foreground"
            />
          ) : (
            <ChevronDownIcon
              aria-hidden="true"
              className="size-3 flex-none text-muted-foreground"
            />
          )}
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
          className="z-[70] rounded-lg border border-border bg-white bg-clip-padding p-1 shadow-lg outline-none"
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
                    "flex min-h-8 w-full cursor-pointer items-center justify-between gap-2 rounded-sm px-2 text-left text-sm font-normal text-foreground max-[799px]:min-h-11 max-[799px]:text-[15px]",
                    i === aktywny && "bg-accent",
                    zaznaczona && "font-medium",
                  )}
                >
                  {opcja.node ? (
                    opcja.node
                  ) : opcja.badge ? (
                    <StatusBadge tone={opcja.badge.tone}>
                      {opcja.badge.label}
                    </StatusBadge>
                  ) : (
                    <span>{opcja.label}</span>
                  )}
                  <span className="flex items-center gap-2">
                    {opcja.hint && (
                      <span className="font-mono text-xs font-normal text-muted-foreground">
                        {opcja.hint}
                      </span>
                    )}
                    {zaznaczona && (
                      <span aria-hidden="true" className="text-success">
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
