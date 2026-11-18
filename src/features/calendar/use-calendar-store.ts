"use client";

// Stan kalendarza po stronie klienta z optymistycznymi zmianami.
// Dane = dane z serwera z nałożonymi zmianami, które jeszcze czekają na odpowiedź akcji.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import type { CalendarData } from "./load-calendar";

export type CalendarChange = (data: CalendarData) => CalendarData;

// zrodlo = dane serwera, przy których zmiana powstała (żeby nie wchłonąć jej drugi raz do nowej bazy)
type Oczekujaca = { id: number; zmiana: CalendarChange; zrodlo: CalendarData };

type Stan = {
  zrodlo: CalendarData; // aktualne dane z serwera
  baza: CalendarData; // zrodlo + zmiany potwierdzone, zanim przyszły nowe dane
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

  // Nowe dane z serwera (inna tożsamość propsa) stają się bazą — Next 16 (Activity) trzyma
  // ukrytą trasę w pamięci i nie montuje jej od nowa. Zmiany, których akcje jeszcze trwają,
  // zostają nałożone na nową bazę i znikają dopiero, gdy ich własna akcja się zakończy.
  let biezacy = stan;
  if (stan.zrodlo !== initial) {
    biezacy = { zrodlo: initial, baza: initial, oczekujace: stan.oczekujace };
    setStan(biezacy);
  }

  const applyOptimistic = useCallback(
    async (
      zmiana: CalendarChange,
      akcja: () => Promise<ActionResult>,
    ): Promise<boolean> => {
      const id = ++licznik.current;
      const zrodlo = initial;
      setStan((s) => ({
        ...s,
        oczekujace: [...s.oczekujace, { id, zmiana, zrodlo }],
      }));

      let udane = false;
      try {
        const wynik = await akcja();
        udane = wynik.ok;
      } catch {
        udane = false;
      }

      setStan((s) => {
        const reszta = s.oczekujace.filter((o) => o.id !== id);
        // Sukces: zmiana wchodzi do bazy, o ile baza pochodzi z tych samych danych serwera
        // (po odświeżeniu serwer już ją zawiera); błąd: zmiana znika (cofnięcie)
        return udane && s.zrodlo === zrodlo
          ? { ...s, baza: zmiana(s.baza), oczekujace: reszta }
          : { ...s, oczekujace: reszta };
      });
      if (!udane) toast.error(BLAD_ZAPISU);
      return udane;
    },
    [initial],
  );

  const data = biezacy.oczekujace.reduce((d, o) => o.zmiana(d), biezacy.baza);
  return { data, pending: biezacy.oczekujace.length, applyOptimistic };
}
