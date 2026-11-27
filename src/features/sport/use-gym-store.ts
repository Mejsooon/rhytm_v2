"use client";

// Serie treningu siłowego po stronie klienta z optymistycznymi zmianami (wzór: use-habits-store).
// Widok = serie z serwera z nałożonymi zmianami, które czekają na odpowiedź akcji, oraz szkice pól
// kg / powt. (wpisywane, jeszcze niezatwierdzone — liczą się od razu do objętości i REKORDU).
// Wspólne dla drzewa web (gym-log) i telefonu (MGym, Task 9).
import { useRef, useState } from "react";
import { toast } from "sonner";

import type { ActionResult } from "@/lib/action-result";
import {
  addExercise as addExerciseAction,
  addSet as addSetAction,
  deleteSet as deleteSetAction,
  removeExercise as removeExerciseAction,
  updateSet,
  type SetPatch,
} from "./actions";
import { EXERCISE_LIBRARY } from "./library";
import type { WorkoutData } from "./load-sport";
import {
  isBodyweightKind,
  kindOf,
  parseDuration,
  parseKgInput,
  parseKm,
  parseRepsInput,
  sessionVolume,
  type ExerciseKind,
  type GymSetRow,
} from "./model";

// bodyweight: ćwiczenie z masą ciała — kg serii to dociążenie (waga z profilu + kg)
export type GymExercise = {
  id: string;
  name: string;
  kind: ExerciseKind;
  bodyweight: boolean;
  sets: GymSetRow[];
};
export type DraftField = "kg" | "reps" | "time" | "km";
type Szkic = Partial<Record<DraftField, string>>;

// Czas serii: "1:30" albo same sekundy "45"
const czytajCzas = (tekst: string) => {
  const t = tekst.trim();
  if (t === "") return null;
  const s = /^\d{1,4}$/.test(t) ? Number(t) : parseDuration(t);
  return s === null || s < 1 || s > 86400 ? undefined : s;
};
const czytajKm = (tekst: string) => {
  if (tekst.trim() === "") return null;
  const km = parseKm(tekst);
  return km === null || km <= 0 || km > 300 ? undefined : km;
};

// Pole formularza → kolumna serii i czytnik (undefined = zły zapis)
const POLA = {
  kg: { kolumna: "weight_kg", czytaj: parseKgInput },
  reps: { kolumna: "reps", czytaj: parseRepsInput },
  time: { kolumna: "duration_s", czytaj: czytajCzas },
  km: { kolumna: "distance_km", czytaj: czytajKm },
} as const;

// Serie i ćwiczenia utworzone na ekranie, zanim serwer nada im id
const TYMCZASOWE = "tmp-";
export const isTempId = (id: string) => id.startsWith(TYMCZASOWE);

type Operacja =
  | { typ: "zmiana"; setId: string; patch: SetPatch }
  | { typ: "seria"; setId: string; exerciseId: string }
  | { typ: "usunSerie"; setId: string }
  | { typ: "usunCwiczenie"; exerciseId: string }
  | {
      typ: "cwiczenie";
      exerciseId: string;
      name: string;
      setIds: string[];
      sessionId: string;
    };

// zrodlo = dane serwera, przy których zmiana powstała (żeby nie wchłonąć jej drugi raz do nowej bazy);
// potwierdzona = serwer zapisał zmianę, ale w międzyczasie przyszły nowe dane — zmiana zostaje nałożona
// aż do kolejnych danych (odświeżenia po tej akcji), żeby ekran nie mignął starą wartością
type Zmiana = {
  id: number;
  op: Operacja;
  zrodlo: WorkoutData;
  potwierdzona: boolean;
};

type Baza = { sets: GymSetRow[]; names: Map<string, string> };

type Stan = {
  zrodlo: WorkoutData; // aktualne dane z serwera
  baza: Baza; // zrodlo + zmiany potwierdzone, zanim przyszły nowe dane
  oczekujace: Zmiana[];
  szkice: Map<string, Szkic>; // id serii → wpisany tekst pól
};

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

function bazaZ(data: WorkoutData): Baza {
  return {
    sets: data.sets,
    names: new Map(data.exercises.map((e) => [e.id, e.name])),
  };
}

// Szkice bez jednego pola serii (nowa mapa — React porównuje referencje)
function bezSzkicuPola(
  szkice: Map<string, Szkic>,
  setId: string,
  field: DraftField,
): Map<string, Szkic> {
  const nowe = new Map(szkice);
  const szkic = { ...nowe.get(setId) };
  delete szkic[field];
  if (Object.keys(szkic).length > 0) nowe.set(setId, szkic);
  else nowe.delete(setId);
  return nowe;
}

// Nowa baza z jedną operacją (bez mutowania poprzedniej — React porównuje referencje)
function nalozOperacje(b: Baza, op: Operacja): Baza {
  switch (op.typ) {
    case "zmiana":
      return {
        ...b,
        sets: b.sets.map((s) =>
          s.id === op.setId ? { ...s, ...op.patch } : s,
        ),
      };
    case "seria": {
      // Kopia ostatniej serii ćwiczenia (kg i powt.), niezrobiona
      let ostatnia: GymSetRow | null = null;
      for (const s of b.sets) {
        if (s.exercise_id !== op.exerciseId) continue;
        if (ostatnia === null || s.set_no > ostatnia.set_no) ostatnia = s;
      }
      // Nowe dane mogą już mieć tę serię (potwierdzona zmiana nałożona do kolejnych danych)
      if (ostatnia === null || b.sets.some((s) => s.id === op.setId)) return b;
      const nowa = {
        ...ostatnia,
        id: op.setId,
        set_no: ostatnia.set_no + 1,
        weight_kg: null,
        reps: null,
        duration_s: null,
        distance_km: null,
        set_type: "N",
        done: false,
      };
      return { ...b, sets: [...b.sets, nowa] };
    }
    case "usunSerie":
      return { ...b, sets: b.sets.filter((s) => s.id !== op.setId) };
    case "usunCwiczenie":
      return {
        ...b,
        sets: b.sets.filter((s) => s.exercise_id !== op.exerciseId),
      };
    case "cwiczenie": {
      // Nowe dane z serwera mogą już zawierać to ćwiczenie — wtedy go nie dublujemy
      const nazwa = op.name.toLowerCase();
      if (
        b.sets.some(
          (s) => (b.names.get(s.exercise_id) ?? "").toLowerCase() === nazwa,
        )
      )
        return b;
      const pozycja =
        Math.max(0, ...b.sets.map((s) => s.exercise_position)) + 1;
      const names = new Map(b.names);
      names.set(op.exerciseId, op.name);
      return {
        names,
        sets: [
          ...b.sets,
          ...op.setIds.map((id, i) => ({
            id,
            user_id: "",
            session_id: op.sessionId,
            exercise_id: op.exerciseId,
            exercise_position: pozycja,
            set_no: i + 1,
            weight_kg: null,
            reps: null,
            done: false,
            set_type: "N",
            duration_s: null,
            distance_km: null,
          })),
        ],
      };
    }
  }
}

export function useGymStore(data: WorkoutData) {
  const [stan, setStan] = useState<Stan>(() => ({
    zrodlo: data,
    baza: bazaZ(data),
    oczekujace: [],
    szkice: new Map(),
  }));
  const licznik = useRef(0);
  const sessionId = data.session.id;

  // Nowe dane z serwera (inna tożsamość obiektu) stają się bazą — Next 16 (Activity) trzyma ukrytą
  // trasę w pamięci i nie montuje jej od nowa. Zmiany w toku i szkice pól zostają nałożone na nową bazę;
  // zmiany już potwierdzone przepadają (razem ze starą bazą albo z listy), bo nowe dane przyszły po ich zapisie.
  let biezacy = stan;
  if (stan.zrodlo !== data) {
    biezacy = {
      ...stan,
      zrodlo: data,
      baza: bazaZ(data),
      oczekujace: stan.oczekujace.filter((z) => !z.potwierdzona),
    };
    setStan(biezacy);
  }

  // Serie po zmianach w toku (bez szkiców) — to porównujemy przy zatwierdzaniu pól
  const poZmianach = biezacy.oczekujace.reduce(
    (b, z) => nalozOperacje(b, z.op),
    biezacy.baza,
  );
  // Serie widoczne: szkice, które dają się odczytać, liczą się od razu
  const sets = poZmianach.sets.map((s) => {
    const szkic = biezacy.szkice.get(s.id);
    if (!szkic) return s;
    const wynik = { ...s };
    for (const [pole, tekst] of Object.entries(szkic) as [DraftField, string][]) {
      const wartosc = POLA[pole].czytaj(tekst);
      if (wartosc !== undefined) wynik[POLA[pole].kolumna] = wartosc;
    }
    return wynik;
  });

  // Ćwiczenia w kolejności pozycji, serie po numerze
  const posortowane = [...sets].sort((a, b) =>
    a.exercise_position !== b.exercise_position
      ? a.exercise_position - b.exercise_position
      : a.set_no - b.set_no,
  );
  // Ćwiczenia z masą ciała: flaga z danych serwera (po id, a dla ćwiczenia dodanego na ekranie
  // po nazwie); nowe ćwiczenie, którego serwer jeszcze nie zwrócił, bierze flagę z biblioteki
  const bodyweightIds = new Set<string>();
  const exercises: GymExercise[] = [];
  for (const s of posortowane) {
    let cwiczenie = exercises.find((e) => e.id === s.exercise_id);
    if (!cwiczenie) {
      const name = poZmianach.names.get(s.exercise_id) ?? "";
      const zBazy =
        data.exercises.find((e) => e.id === s.exercise_id) ??
        data.exercises.find((e) => e.name.toLowerCase() === name.toLowerCase());
      const zBiblioteki = EXERCISE_LIBRARY.find(
        (l) => l.name.toLowerCase() === name.toLowerCase(),
      );
      const kind: ExerciseKind = zBazy
        ? kindOf(zBazy)
        : (zBiblioteki?.kind ?? "wr");
      const bodyweight = isBodyweightKind(kind);
      if (bodyweight) bodyweightIds.add(s.exercise_id);
      cwiczenie = { id: s.exercise_id, name, kind, bodyweight, sets: [] };
      exercises.push(cwiczenie);
    }
    cwiczenie.sets.push(s);
  }

  // Zmiana widoczna od razu; sukces wchodzi do bazy (o ile baza pochodzi z tych samych danych serwera),
  // błąd cofa zmianę i pokazuje toast. `potwierdzona` podmienia tymczasowe id na id z serwera.
  async function wykonaj(
    op: Operacja,
    wyslij: () => Promise<ActionResult>,
    potwierdzona: (wynik: ActionResult) => Operacja = () => op,
    bezSzkicu?: { setId: string; field: DraftField },
  ) {
    const id = ++licznik.current;
    const zrodlo = data;
    setStan((s) => {
      const szkice = bezSzkicu
        ? bezSzkicuPola(s.szkice, bezSzkicu.setId, bezSzkicu.field)
        : s.szkice;
      return {
        ...s,
        szkice,
        oczekujace: [...s.oczekujace, { id, op, zrodlo, potwierdzona: false }],
      };
    });

    let wynik: ActionResult;
    try {
      wynik = await wyslij();
    } catch {
      wynik = { ok: false, message: BLAD_ZAPISU };
    }

    setStan((s) => {
      const reszta = s.oczekujace.filter((o) => o.id !== id);
      // Błąd: zmiana znika (cofnięcie)
      if (!wynik.ok) return { ...s, oczekujace: reszta };
      // Sukces przy tych samych danych serwera: zmiana wchodzi do bazy
      if (s.zrodlo === zrodlo)
        return {
          ...s,
          baza: nalozOperacje(s.baza, potwierdzona(wynik)),
          oczekujace: reszta,
        };
      // Sukces po nowych danych: zostaje nałożona (z id z serwera) do następnych danych
      return {
        ...s,
        oczekujace: s.oczekujace.map((o) =>
          o.id === id
            ? { ...o, op: potwierdzona(wynik), potwierdzona: true }
            : o,
        ),
      };
    });
    if (!wynik.ok) toast.error(BLAD_ZAPISU);
  }

  // Wpisywanie w pole kg / powt. (bez zapisu)
  function setDraft(setId: string, field: DraftField, text: string) {
    setStan((s) => {
      const szkice = new Map(s.szkice);
      szkice.set(setId, { ...szkice.get(setId), [field]: text });
      return { ...s, szkice };
    });
  }

  // Wyjście z pola / Enter: zły zapis wraca do poprzedniej wartości, inna wartość idzie na serwer
  async function commitDraft(setId: string, field: DraftField) {
    const tekst = biezacy.szkice.get(setId)?.[field];
    if (tekst === undefined) return;
    const { kolumna, czytaj } = POLA[field];
    const wartosc = czytaj(tekst);
    const seria = poZmianach.sets.find((s) => s.id === setId);
    if (
      wartosc === undefined ||
      !seria ||
      isTempId(setId) ||
      wartosc === seria[kolumna]
    ) {
      // Tylko porzucenie szkicu
      setStan((s) => ({
        ...s,
        szkice: bezSzkicuPola(s.szkice, setId, field),
      }));
      return;
    }
    const patch: SetPatch = { [kolumna]: wartosc };
    await wykonaj(
      { typ: "zmiana", setId, patch },
      () => updateSet(setId, patch),
      undefined,
      { setId, field },
    );
  }

  // Zmiana pól serii naraz (typ serii, „Poprzednio”, odhaczenie)
  async function update(setId: string, patch: SetPatch) {
    if (isTempId(setId)) return;
    // Szkice pól, które nadpisujemy, znikają
    setStan((s) => {
      let szkice = s.szkice;
      for (const [pole, { kolumna }] of Object.entries(POLA)) {
        if (kolumna in patch) szkice = bezSzkicuPola(szkice, setId, pole as DraftField);
      }
      return { ...s, szkice };
    });
    await wykonaj({ typ: "zmiana", setId, patch }, () => updateSet(setId, patch));
  }

  // Odhaczenie; `wypelnij` to wartości z „Poprzednio” dla pustej serii
  async function toggleDone(setId: string, wypelnij: SetPatch = {}) {
    const seria = poZmianach.sets.find((s) => s.id === setId);
    if (!seria) return;
    await update(setId, seria.done ? { done: false } : { ...wypelnij, done: true });
  }

  async function addSet(exerciseId: string) {
    if (isTempId(exerciseId)) return;
    const op: Operacja = {
      typ: "seria",
      setId: `${TYMCZASOWE}${++licznik.current}`,
      exerciseId,
    };
    await wykonaj(
      op,
      () => addSetAction(sessionId, exerciseId),
      (wynik) => (wynik.ok && wynik.id ? { ...op, setId: wynik.id } : op),
    );
  }

  async function deleteSet(setId: string) {
    if (isTempId(setId)) return;
    await wykonaj({ typ: "usunSerie", setId }, () => deleteSetAction(setId));
  }

  async function removeExercise(exerciseId: string) {
    if (isTempId(exerciseId)) return;
    await wykonaj({ typ: "usunCwiczenie", exerciseId }, () =>
      removeExerciseAction(sessionId, exerciseId),
    );
  }

  // Nowe ćwiczenie z 3 pustymi seriami; id serii przyjdą z odświeżeniem danych serwera
  async function addExercise(name: string) {
    const n = ++licznik.current;
    const op: Operacja = {
      typ: "cwiczenie",
      exerciseId: `${TYMCZASOWE}${n}`,
      name,
      setIds: [1, 2, 3].map((nr) => `${TYMCZASOWE}${n}-${nr}`),
      sessionId,
    };
    await wykonaj(
      op,
      () => addExerciseAction(sessionId, name),
      (wynik) => (wynik.ok && wynik.id ? { ...op, exerciseId: wynik.id } : op),
    );
  }

  return {
    exercises,
    drafts: biezacy.szkice,
    volume: sessionVolume(sets, bodyweightIds, data.profile.weightKg),
    doneCount: sets.filter((s) => s.done).length,
    totalCount: sets.length,
    setDraft,
    commitDraft,
    update,
    toggleDone,
    addSet,
    deleteSet,
    removeExercise,
    addExercise,
  };
}

// Stan treningu przekazywany z GymLog do drzewa telefonu (MGym) — jeden store na ekran
export type GymStore = ReturnType<typeof useGymStore>;
