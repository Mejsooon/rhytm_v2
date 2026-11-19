"use client";

import * as React from "react";

// Siatka ikon stron — dosłownie z PageMenu.dc.html (okno „Wybór ikony”: 6 kolumn, przyciski 32 px)
export const ICONS: string[] = [
  "▦", "▤", "◉", "★", "♪", "✈",
  "⌂", "✎", "⚑", "◷", "✱", "☰",
  "⚙", "◆", "●", "▲", "♥", "✉",
];

export function IconGrid({
  current,
  onPick,
}: {
  current: string;
  onPick: (icon: string) => void;
}) {
  const [fraza, setFraza] = React.useState("");
  const widoczne = ICONS.filter((i) => fraza.trim() === "" || i.includes(fraza.trim()));

  return (
    <div role="group" aria-label="Wybór ikony" className="p-1">
      <input
        type="text"
        value={fraza}
        onChange={(e) => setFraza(e.target.value)}
        placeholder="Szukaj ikony"
        aria-label="Szukaj ikony"
        className="mb-2 box-border w-full rounded-md border border-[#e0e0e0] bg-white px-2.5 py-2 text-sm text-[#171717] outline-none placeholder:text-[#a3a3a3] focus:border-[#171717]"
      />
      <div className="grid grid-cols-6 gap-1 text-center font-mono text-[15px]">
        {widoczne.map((ikona) => (
          <button
            key={ikona}
            type="button"
            aria-label={`Ikona ${ikona}`}
            aria-pressed={ikona === current}
            onClick={() => onPick(ikona)}
            className={`h-8 cursor-pointer rounded-md font-[inherit] hover:bg-[#f5f5f5] max-[799px]:h-11 ${
              ikona === current
                ? "border border-[#171717] bg-[#f5f5f5]"
                : "border-0 bg-transparent"
            }`}
          >
            {ikona}
          </button>
        ))}
      </div>
    </div>
  );
}
