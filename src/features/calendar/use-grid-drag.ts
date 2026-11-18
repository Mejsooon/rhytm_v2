"use client";

// Logika wskaźnika dla siatki godzin: tworzenie zakresu, przesuwanie i rozciąganie bloków.
// Obliczenia minut są w drag.ts (czyste); tu jest tylko obsługa zdarzeń i podgląd gestu.
// Podczas gestu oryginalny blok zostaje w drzewie (przechwycenie wskaźnika nie ginie przy
// zmianie kolumny), a pod kursorem rysuje się osobny podgląd.
import {
  useEffect,
  useRef,
  useState,
  type PointerEvent,
  type RefObject,
} from "react";

import type { IsoDate } from "@/components/controls/calendar-math";
import {
  dragResult,
  KROK,
  type DragKind,
  type DragPoint,
  type DragResult,
} from "./drag";
import type { Occurrence } from "./occurrences";

// Ruch krótszy niż tyle pikseli to zwykły klik, nie przeciąganie
const PROG_PX = 4;

export type DragPreview = DragResult & { kind: DragKind; key: string | null };

export function useGridDrag({
  korzen,
  wysokoscGodziny,
  onRange,
  onBlock,
}: {
  // Przewijany kontener siatki: jego prostokąt to „siatka”, poza nią puszczenie anuluje gest
  korzen: RefObject<HTMLElement | null>;
  wysokoscGodziny: number;
  onRange?: (range: DragResult) => void;
  onBlock?: (occurrence: Occurrence, result: DragResult) => void;
}) {
  const [podglad, setPodglad] = useState<DragPreview | null>(null);
  // Najnowsze callbacki (słuchacze okna żyją dłużej niż jeden render)
  const callbacki = useRef({ onRange, onBlock });
  useEffect(() => {
    callbacki.current = { onRange, onBlock };
  });
  // Po prawdziwym przeciągnięciu przeglądarka wysyła jeszcze klik — ten flag go tłumi
  const bylRuch = useRef(false);
  const sprzatanie = useRef<(() => void) | null>(null);
  // Odmontowanie w trakcie gestu zdejmuje słuchaczy z okna
  useEffect(() => () => sprzatanie.current?.(), []);

  // Podpiąć pod onClickCapture kolumny: połyka klik zaraz po przeciągnięciu
  function tlumKlik(e: React.MouseEvent) {
    if (!bylRuch.current) return;
    bylRuch.current = false;
    e.preventDefault();
    e.stopPropagation();
  }

  function zacznij(
    e: PointerEvent<HTMLElement>,
    kind: DragKind,
    opis: { occurrence?: Occurrence } = {},
  ) {
    // Tylko główny przycisk; drugi gest w trakcie pierwszego ignorujemy
    // Dotyk zostaje przewijaniem siatki; przeciągamy myszą i piórem
    if (e.pointerType === "touch") return;
    if (e.button !== 0 || sprzatanie.current) return;
    const panel = korzen.current;
    if (!panel) return;
    const element = e.currentTarget;
    const { occurrence } = opis;
    const oryginal = occurrence && {
      startMin: occurrence.startMin,
      durationMin: occurrence.durationMin,
    };

    // Dzień kolumny i minuta pod wskaźnikiem; „poza” = wskaźnik poza przewijaną siatką
    const pozycja = (x: number, y: number): DragPoint & { poza: boolean } => {
      const kolumny = [
        ...panel.querySelectorAll<HTMLElement>("[data-kolumna]"),
      ];
      const ramka = panel.getBoundingClientRect();
      // Kolumna, której lewa krawędź jest na lewo od wskaźnika (ostatnia taka)
      let kolumna = kolumny[0];
      for (const k of kolumny) {
        if (x >= k.getBoundingClientRect().left) kolumna = k;
      }
      const gora = kolumna.getBoundingClientRect().top;
      const min = Math.min(
        Math.max(((y - gora) / wysokoscGodziny) * 60, 0),
        1440,
      );
      return {
        date: kolumna.dataset.kolumna as IsoDate,
        min,
        // Przed pierwszą kolumną jest gutter z godzinami: to też „poza siatką”
        poza:
          x < kolumny[0].getBoundingClientRect().left ||
          x < ramka.left ||
          x > ramka.right ||
          y < ramka.top ||
          y > ramka.bottom,
      };
    };

    const start = pozycja(e.clientX, e.clientY);
    const x0 = e.clientX;
    const y0 = e.clientY;
    const pointerId = e.pointerId;
    let ruszono = false;
    let anulowano = false;
    // Blok ani puste miejsce pod nim nie dostają zdarzenia dalej (np. tworzenie pod blokiem)
    e.stopPropagation();
    element.setPointerCapture?.(pointerId);

    const koniec = () => {
      window.removeEventListener("pointermove", przyRuchu);
      window.removeEventListener("pointerup", przyPuszczeniu);
      window.removeEventListener("pointercancel", przyAnulowaniu);
      window.removeEventListener("keydown", przyKlawiszu);
      window.removeEventListener("blur", przyAnulowaniu);
      try {
        element.releasePointerCapture?.(pointerId);
      } catch {
        // Przechwycenie mogło już zniknąć razem z elementem
      }
      sprzatanie.current = null;
      setPodglad(null);
      // Klik po gestzie przychodzi od razu; gdyby nie przyszedł, flaga nie zostaje na zawsze
      if (ruszono) setTimeout(() => (bylRuch.current = false), 0);
    };

    function przyRuchu(ev: globalThis.PointerEvent) {
      if (anulowano) return;
      // Przycisk puszczony poza oknem (pointerup zgubiony): kończymy gest bez zapisu
      if (ev.buttons === 0) {
        przyAnulowaniu();
        return;
      }
      if (!ruszono) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < PROG_PX) return;
        ruszono = true;
        bylRuch.current = true;
      }
      const wynik = dragResult(
        kind,
        start,
        pozycja(ev.clientX, ev.clientY),
        oryginal,
      );
      setPodglad(wynik && { ...wynik, kind, key: occurrence?.key ?? null });
    }

    function przyPuszczeniu(ev: globalThis.PointerEvent) {
      const biezaca = pozycja(ev.clientX, ev.clientY);
      let wynik =
        ruszono && !anulowano && !biezaca.poza
          ? dragResult(kind, start, biezaca, oryginal)
          : null;
      // Ruch bez zmiany dnia i bez pełnego kroku w pionie nie zmienia bloku (stare starty spoza siatki zostają)
      if (
        kind !== "create" &&
        biezaca.date === start.date &&
        Math.round((biezaca.min - start.min) / KROK) === 0
      ) {
        wynik = null;
      }
      koniec();
      if (!wynik) return;
      if (kind === "create") callbacki.current.onRange?.(wynik);
      else if (occurrence) callbacki.current.onBlock?.(occurrence, wynik);
    }

    function przyAnulowaniu() {
      anulowano = true;
      koniec();
    }

    function przyKlawiszu(ev: KeyboardEvent) {
      if (ev.key !== "Escape") return;
      // Podgląd znika od razu, a słuchacze zostają do puszczenia przycisku (tłumienie kliku)
      anulowano = true;
      setPodglad(null);
    }

    window.addEventListener("pointermove", przyRuchu);
    window.addEventListener("pointerup", przyPuszczeniu);
    window.addEventListener("pointercancel", przyAnulowaniu);
    window.addEventListener("keydown", przyKlawiszu);
    window.addEventListener("blur", przyAnulowaniu);
    sprzatanie.current = koniec;
  }

  return { podglad, zacznij, tlumKlik };
}
