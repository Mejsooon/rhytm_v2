"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ReactNode } from "react";

// Pole hasła z przyciskiem „Pokaż hasło” / „Ukryj hasło”.
// Układ siatką: web — etykieta i link w jednym wierszu nad polem (Login.dc.html),
// telefon — link pod polem, wyrównany do prawej (MLogin.dc.html). Jeden link w DOM, różnice tylko CSS.
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
        <div className="col-start-2 row-start-1 font-normal max-[799px]:col-span-2 max-[799px]:row-start-3 max-[799px]:mt-2 max-[799px]:justify-self-end max-[799px]:py-1">
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
          className={`w-full rounded-md border border-[#e0e0e0] bg-white py-[9px] pr-11 pl-[11px] text-sm leading-[1.21] font-normal text-[#171717] outline-none placeholder:text-[#a3a3a3] ${webPlaceholder ? "min-[800px]:placeholder:text-transparent" : placeholder ? "" : "min-[800px]:placeholder:opacity-0"} peer focus:border-[#171717] max-[799px]:h-12 max-[799px]:rounded-[10px] max-[799px]:py-0 max-[799px]:pr-[52px] max-[799px]:pl-3.5 max-[799px]:text-[15px]`}
        />
        {webPlaceholder && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-[11px] -translate-y-1/2 text-sm leading-[1.21] text-[#a3a3a3] opacity-0 peer-placeholder-shown:opacity-100 max-[799px]:hidden"
          >
            {webPlaceholder}
          </span>
        )}
        <button
          type="button"
          aria-label={shown ? "Ukryj hasło" : "Pokaż hasło"}
          aria-pressed={shown}
          onClick={() => setShown((v) => !v)}
          className="absolute top-1 right-1 flex cursor-pointer items-center justify-center rounded-md border-0 bg-transparent p-1.5 text-[#666666] outline-none hover:bg-[#f5f5f5] focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:top-0.5 max-[799px]:right-0.5 max-[799px]:size-11 max-[799px]:rounded-[10px] max-[799px]:p-0"
        >
          {shown ? (
            <EyeOff aria-hidden="true" className="size-4 max-[799px]:size-[18px]" />
          ) : (
            <Eye aria-hidden="true" className="size-4 max-[799px]:size-[18px]" />
          )}
        </button>
      </div>
    </div>
  );
}
