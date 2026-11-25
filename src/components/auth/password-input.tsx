"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

import { FIELD } from "@/components/controls/field";
import { cn } from "@/lib/utils";

// Pole hasła z przyciskiem „Pokaż hasło” / „Ukryj hasło”.
// Układ siatką: web — etykieta i link w jednym wierszu nad polem (CLogin.dc.html),
// telefon — link pod polem, wyrównany do prawej, cel 44 px (CMLogin.dc.html). Jeden link w DOM, różnice tylko CSS.
export function PasswordInput({
  name,
  label,
  autoComplete,
  rightLink,
  placeholder,
  webPlaceholder,
  value,
  onChange,
  className,
}: {
  name: string;
  label: string;
  autoComplete: string;
  rightLink?: ReactNode;
  // Bez własnego placeholdera pole wygląda jak w logowaniu (kropki, na webie ukryte)
  placeholder?: string;
  // Inny tekst podpowiedzi na webie (≥800 px): natywny placeholder jest wtedy przezroczysty,
  // a tekst web pokazuje nakładka widoczna tylko przy pustym polu (bez matchMedia)
  webPlaceholder?: string;
  // Pole sterowane: React 19 czyści niesterowane pola po akcji formularza, a stan hasła u rodzica zostałby stary
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}) {
  const id = useId();
  const [shown, setShown] = useState(false);

  return (
    <div
      className={`grid grid-cols-[1fr_auto] gap-y-1.5 text-[13px] font-medium ${className ?? ""}`}
    >
      <label htmlFor={id} className="col-start-1 row-start-1">
        {label}
      </label>
      {rightLink && (
        <div className="col-start-2 row-start-1 font-normal max-[799px]:col-span-2 max-[799px]:row-start-3 max-[799px]:-mt-0.5 max-[799px]:-mb-3 max-[799px]:justify-self-end">
          {rightLink}
        </div>
      )}
      <div className="relative col-span-2 row-start-2">
        <input
          id={id}
          name={name}
          type={shown ? "text" : "password"}
          autoComplete={autoComplete}
          required
          placeholder={placeholder ?? "••••••••"}
          value={value}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          className={cn(
            FIELD,
            "peer pr-11 max-[799px]:pr-[52px]",
            webPlaceholder
              ? "min-[800px]:placeholder:text-transparent"
              : !placeholder && "min-[800px]:placeholder:opacity-0",
          )}
        />
        {webPlaceholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-sm leading-[1.21] text-faint-foreground opacity-0 peer-placeholder-shown:opacity-100 max-[799px]:hidden"
          >
            {webPlaceholder}
          </span>
        )}
        <button
          type="button"
          aria-label={shown ? "Ukryj hasło" : "Pokaż hasło"}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="absolute top-1 right-1 flex size-6 cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent p-0 text-muted-foreground outline-none hover:bg-accent focus-visible:shadow-focus max-[799px]:top-0 max-[799px]:right-0 max-[799px]:size-11 max-[799px]:rounded-md"
        >
          {shown ? (
            <EyeOff
              aria-hidden="true"
              className="size-4 max-[799px]:size-[18px]"
            />
          ) : (
            <Eye
              aria-hidden="true"
              className="size-4 max-[799px]:size-[18px]"
            />
          )}
        </button>
      </div>
    </div>
  );
}
