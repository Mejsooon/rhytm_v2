"use client";

// Stan kalendarza po stronie klienta z optymistycznymi zmianami.
// Dane = dane z serwera z nałożonymi zmianami, które jeszcze czekają na odpowiedź akcji.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import type { CalendarData } from "./load-calendar";

export type CalendarChange = (data: CalendarData) => CalendarData;

type Oczekujaca = { id: number; zmiana: CalendarChange };

type Stan = {
  zrodlo: CalendarData; // dane z serwera, od których zaczęliśmy
  baza: CalendarData; // zrodlo + zmiany już potwierdzone przez serwer
  oczekujace: Oczekujaca[];
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function useCalendarStore(initial: CalendarData) {
  const [stan, setStan] = useState<Stan>({
    zrodlo: initial,
    baza: initial,
    oczekujace: [],
  });
  const licznik = useRef(0);

  // Nowe dane z serwera (inna tożsamość propsa) zastępują wszystko, także zmiany w toku.
  // Potrzebne, bo Next 16 (Activity) trzyma ukrytą trasę w pamięci i nie montuje jej od nowa.
  let biezacy = stan;
  if (stan.zrodlo !== initial) {
    biezacy = { zrodlo: initial, baza: initial, oczekujace: [] };
    setStan(biezacy);
  }

  const applyOptimistic = useCallback(
    async (
      zmiana: CalendarChange,
      akcja: () => Promise<ActionResult>,
    ): Promise<boolean> => {
      const id = ++licznik.current;
      const zrodlo = initial;
      setStan((s) =>
        s.zrodlo !== zrodlo
          ? s
          : { ...s, oczekujace: [...s.oczekujace, { id, zmiana }] },
      );

      let udane = false;
      try {
        const wynik = await akcja();
        udane = wynik.ok;
      } catch {
        udane = false;
      }

      // Jeśli w międzyczasie przyszły nowe dane serwera, nie ruszamy już stanu
      setStan((s) => {
        if (s.zrodlo !== zrodlo) return s;
        const reszta = s.oczekujace.filter((o) => o.id !== id);
        // Sukces: zmiana wchodzi do bazy; błąd: znika (cofnięcie)
        return udane
          ? { ...s, baza: zmiana(s.baza), oczekujace: reszta }
          : { ...s, oczekujace: reszta };
      });
      if (!udane) toast.error(BLAD_ZAPISU);
      return udane;
    },
    [initial],
  );

  const data = biezacy.oczekujace.reduce(
    (d, o) => o.zmiana(d),
    biezacy.baza,
  );
  return { data, pending: biezacy.oczekujace.length, applyOptimistic };
}
