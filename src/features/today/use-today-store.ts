"use client";

// Stan ekranu Dziś po stronie klienta z optymistycznymi zmianami (wzorzec jak useCalendarStore).
// Plan dnia („x/y” bloków), „Zadania na dziś” i karta „Ten tydzień” liczą się z tych samych
// `data.tasks`, więc jedno odhaczenie zmienia od razu wszystkie trzy miejsca.
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/action-result";
import type { TodayData } from "./load-today";

export type TodayChange = (data: TodayData) => TodayData;

// zrodlo = dane serwera, przy których zmiana powstała (żeby nie wchłonąć jej drugi raz do nowej bazy)
type Oczekujaca = { id: number; zmiana: TodayChange; zrodlo: TodayData };

type Stan = {
  zrodlo: TodayData; // aktualne dane z serwera
  baza: TodayData; // zrodlo + zmiany potwierdzone, zanim przyszły nowe dane
  oczekujace: Oczekujaca[];
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export function useTodayStore(initial: TodayData) {
  const [stan, setStan] = useState<Stan>({
    zrodlo: initial,
    baza: initial,
    oczekujace: [],
  });
  const licznik = useRef(0);

  // Nowe dane z serwera (np. po router.refresh) stają się bazą — Next 16 (Activity) nie montuje
  // trasy od nowa. Zmiany, których akcje jeszcze trwają, zostają nałożone na nową bazę.
  let biezacy = stan;
  if (stan.zrodlo !== initial) {
    biezacy = { zrodlo: initial, baza: initial, oczekujace: stan.oczekujace };
    setStan(biezacy);
  }

  const applyOptimistic = useCallback(
    async (
      zmiana: TodayChange,
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
        // Sukces: zmiana wchodzi do bazy, o ile baza pochodzi z tych samych danych serwera;
        // błąd: zmiana znika (cofnięcie) i jest toast
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
  return { data, applyOptimistic };
}
