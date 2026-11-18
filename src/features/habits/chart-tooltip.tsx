"use client";

// Ciemny dymek wykresu (heatmapa, słupki snu) w portalu na <body> z position: fixed,
// żeby przewijane karty (overflow) go nie przycinały. Pozycja liczona z getBoundingClientRect
// komórki: nad nią, a gdy brakuje miejsca — pod nią; zawsze w granicach okna.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

const ODSTEP = 8; // px między komórką a dymkiem
const MARGINES = 8; // px od krawędzi okna

export function ChartTooltip({
  anchor,
  children,
}: {
  anchor: HTMLElement;
  children: ReactNode;
}) {
  const dymek = useRef<HTMLDivElement>(null);
  const [pozycja, setPozycja] = useState<{ left: number; top: number } | null>(
    null,
  );

  // Mierzymy dymek po wyrenderowaniu, zanim przeglądarka go narysuje
  useLayoutEffect(() => {
    const el = dymek.current;
    if (!el) return;
    const komorka = anchor.getBoundingClientRect();
    const szer = el.offsetWidth;
    const wys = el.offsetHeight;
    const srodek = komorka.left + komorka.width / 2;
    const left = Math.min(
      Math.max(srodek - szer / 2, MARGINES),
      window.innerWidth - szer - MARGINES,
    );
    const nad = komorka.top - wys - ODSTEP;
    const top =
      nad >= MARGINES
        ? nad
        : Math.min(
            komorka.bottom + ODSTEP,
            window.innerHeight - wys - MARGINES,
          );
    setPozycja({ left, top });
    // Liczymy tylko przy zmianie komórki (treść dla jednej komórki się nie zmienia)
  }, [anchor]);

  return createPortal(
    <div
      ref={dymek}
      role="tooltip"
      className="pointer-events-none fixed z-50 rounded-lg bg-[#171717] px-2.5 py-2 text-xs leading-[1.4] whitespace-nowrap text-white shadow-[0_8px_20px_rgba(0,0,0,.18)]"
      // Przed pomiarem dymek jest niewidoczny w lewym górnym rogu
      style={
        pozycja
          ? { left: pozycja.left, top: pozycja.top }
          : { left: 0, top: 0, visibility: "hidden" }
      }
    >
      {children}
    </div>,
    document.body,
  );
}
