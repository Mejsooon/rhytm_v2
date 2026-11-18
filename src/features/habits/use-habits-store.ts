"use client";

// Odhaczenia nawyków po stronie klienta z optymistycznymi zmianami (wzór: use-calendar-store).
// Odhaczenia = odhaczenia z serwera z nałożonymi zmianami, które jeszcze czekają na odpowiedź akcji.
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { IsoDate } from "@/components/controls/calendar-math";
import { setHabitCheck } from "./actions";
import type { HabitsPageData } from "./load-habits";
import type { Checks } from "./model";

type OdhaczeniaSerwera = HabitsPageData["checks"];

// zrodlo = odhaczenia serwera, przy których zmiana powstała (żeby nie wchłonąć jej drugi raz do nowej bazy)
type Zmiana = {
  id: number;
  habitId: string;
  date: IsoDate;
  done: boolean;
  zrodlo: OdhaczeniaSerwera;
};

type Stan = {
  zrodlo: OdhaczeniaSerwera; // aktualne odhaczenia z serwera
  baza: Checks; // zrodlo + zmiany potwierdzone, zanim przyszły nowe dane
  oczekujace: Zmiana[];
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Lista wierszy z serwera → mapa nawyk → zbiór dat
function doMapy(lista: OdhaczeniaSerwera): Checks {
  const mapa: Checks = new Map();
  for (const { habitId, date } of lista) {
    const dni = mapa.get(habitId) ?? new Set<IsoDate>();
    dni.add(date);
    mapa.set(habitId, dni);
  }
  return mapa;
}

// Nowa mapa z jedną zmianą (bez mutowania poprzedniej — React porównuje referencje)
function nalozZmiane(
  checks: Checks,
  z: { habitId: string; date: IsoDate; done: boolean },
): Checks {
  const mapa = new Map(checks);
  const dni = new Set(checks.get(z.habitId) ?? []);
  if (z.done) dni.add(z.date);
  else dni.delete(z.date);
  mapa.set(z.habitId, dni);
  return mapa;
}

export function useHabitsStore(data: HabitsPageData) {
  const [stan, setStan] = useState<Stan>(() => ({
    zrodlo: data.checks,
    baza: doMapy(data.checks),
    oczekujace: [],
  }));
  const licznik = useRef(0);

  // Nowe dane z serwera (inna tożsamość tablicy) stają się bazą — Next 16 (Activity) trzyma
  // ukrytą trasę w pamięci i nie montuje jej od nowa. Zmiany w toku zostają nałożone na nową bazę.
  // Zmiany już zakończone (potwierdzone w starej bazie) przepadają razem z nią — to bezpieczne,
  // bo serwer zapisał je przed odświeżeniem (revalidatePath po akcji), więc nowe dane już je zawierają.
  // Zmiana zakończona po przyjściu nowych danych też nie trafia do bazy (zrodlo się różni),
  // bo jej akcja sama wywołuje kolejne odświeżenie z jej wynikiem.
  let biezacy = stan;
  if (stan.zrodlo !== data.checks) {
    biezacy = {
      zrodlo: data.checks,
      baza: doMapy(data.checks),
      oczekujace: stan.oczekujace,
    };
    setStan(biezacy);
  }

  const checks = biezacy.oczekujace.reduce(nalozZmiane, biezacy.baza);

  async function toggle(habitId: string, date: IsoDate) {
    // Klik odwraca to, co użytkownik właśnie widzi
    const done = !(checks.get(habitId)?.has(date) ?? false);
    const id = ++licznik.current;
    const zrodlo = data.checks;
    setStan((s) => ({
      ...s,
      oczekujace: [...s.oczekujace, { id, habitId, date, done, zrodlo }],
    }));

    let udane = false;
    try {
      const wynik = await setHabitCheck(habitId, date, done);
      udane = wynik.ok;
    } catch {
      udane = false;
    }

    setStan((s) => {
      const reszta = s.oczekujace.filter((o) => o.id !== id);
      // Sukces: zmiana wchodzi do bazy, o ile baza pochodzi z tych samych danych serwera;
      // błąd: zmiana znika (cofnięcie)
      return udane && s.zrodlo === zrodlo
        ? {
            ...s,
            baza: nalozZmiane(s.baza, { habitId, date, done }),
            oczekujace: reszta,
          }
        : { ...s, oczekujace: reszta };
    });
    if (!udane) toast.error(BLAD_ZAPISU);
  }

  return { checks, pending: biezacy.oczekujace.length, toggle };
}
