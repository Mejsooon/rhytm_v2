import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  toastError,
  updateSet,
  addSet,
  deleteSet,
  removeExercise,
  addExercise,
} = vi.hoisted(() => ({
  toastError: vi.fn(),
  updateSet: vi.fn(),
  addSet: vi.fn(),
  deleteSet: vi.fn(),
  removeExercise: vi.fn(),
  addExercise: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({
  updateSet,
  addSet,
  deleteSet,
  removeExercise,
  addExercise,
}));

import { daneTreningu, SESJA, seriaTreningu } from "./gym-test-data";
import type { WorkoutData } from "./load-sport";
import { POMPKI, WYCISKANIE } from "./sport-test-data";
import { useGymStore } from "./use-gym-store";

beforeEach(() => vi.clearAllMocks());

const serieWyciskania = (r: { current: ReturnType<typeof useGymStore> }) =>
  r.current.exercises.find((e) => e.id === WYCISKANIE)?.sets ?? [];

describe("useGymStore", () => {
  it("ćwiczenia w kolejności pozycji z nazwami, liczniki i objętość", () => {
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    expect(result.current.exercises.map((e) => e.name)).toEqual([
      "Wyciskanie na ławce",
      "Pompki na poręczach",
    ]);
    expect(result.current.volume).toBe(1202.5);
    expect(result.current.doneCount).toBe(3);
    expect(result.current.totalCount).toBe(6);
  });

  it("ćwiczenie z masą ciała: objętość = (waga z profilu + dociążenie) × powt.", () => {
    const baza = daneTreningu();
    const d = daneTreningu({
      exercises: baza.exercises.map((e) =>
        e.id === POMPKI ? { ...e, bodyweight: true } : e,
      ),
      sets: baza.sets.map((s) =>
        s.id === "p1"
          ? { ...s, done: true }
          : s.id === "p2"
            ? { ...s, done: true, weight_kg: 5 }
            : s,
      ),
    });
    const { result } = renderHook(() => useGymStore(d));
    expect(
      result.current.exercises.find((e) => e.id === POMPKI)?.bodyweight,
    ).toBe(true);
    expect(
      result.current.exercises.find((e) => e.id === WYCISKANIE)?.bodyweight,
    ).toBe(false);
    // 1202,5 (wyciskanie) + 72 × 12 + 77 × 10
    expect(result.current.volume).toBe(1202.5 + 864 + 770);
    // Bez wagi w profilu serie z masą ciała nie liczą się do objętości
    const bezWagi = { ...d, profile: { ...d.profile, weightKg: null } };
    const { result: r2 } = renderHook(() => useGymStore(bezWagi));
    expect(r2.current.volume).toBe(1202.5);
  });

  it("nowe ćwiczenie z biblioteki dodane na ekranie ma flagę masy ciała", () => {
    addExercise.mockReturnValue(new Promise(() => {}));
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    act(() => {
      void result.current.addExercise("Dipy");
    });
    expect(result.current.exercises.at(-1)).toMatchObject({
      name: "Dipy",
      bodyweight: true,
    });
  });

  it("szkic kg liczy się od razu, a zatwierdzenie wysyła liczbę", async () => {
    updateSet.mockResolvedValue({ ok: true });
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    act(() => result.current.setDraft("w1", "kg", "80"));
    expect(result.current.volume).toBe(1262.5);
    expect(result.current.drafts.get("w1")?.kg).toBe("80");
    await act(async () => result.current.commitDraft("w1", "kg"));
    expect(updateSet).toHaveBeenCalledWith("w1", { weight_kg: 80 });
    expect(result.current.drafts.has("w1")).toBe(false);
    expect(serieWyciskania(result)[0].weight_kg).toBe(80);
  });

  it("niezmieniona wartość nie wysyła zapisu", async () => {
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    act(() => result.current.setDraft("w1", "reps", "6"));
    await act(async () => result.current.commitDraft("w1", "reps"));
    expect(updateSet).not.toHaveBeenCalled();
  });

  it("nowe dane z serwera stają się bazą, a zmiany w toku zostają nałożone", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    updateSet.mockReturnValue(new Promise((r) => (zakoncz = r)));
    let dane: WorkoutData = daneTreningu();
    const { result, rerender } = renderHook(() => useGymStore(dane));
    act(() => {
      void result.current.toggleDone("w4");
    });
    expect(result.current.doneCount).toBe(4);

    // Serwer dorzucił serię (np. z innej karty)
    dane = daneTreningu({
      sets: [
        ...daneTreningu().sets,
        seriaTreningu("w5", SESJA, WYCISKANIE, 1, 5, 72.5, 3, true),
      ],
    });
    rerender();
    expect(result.current.totalCount).toBe(7);
    expect(result.current.doneCount).toBe(5);

    await act(async () => zakoncz({ ok: true }));
    // Zmiana potwierdzona po nowych danych zostaje nałożona (bez mignięcia starą wartością)…
    expect(result.current.doneCount).toBe(5);

    // …aż do następnych danych z serwera (odświeżenie po tej akcji już ją zawiera)
    const bezW4 = daneTreningu().sets.concat(
      seriaTreningu("w5", SESJA, WYCISKANIE, 1, 5, 72.5, 3, true),
    );
    dane = daneTreningu({ sets: bezW4 });
    rerender();
    expect(result.current.doneCount).toBe(4);
  });

  it("potwierdzona „+ Seria” po nowych danych nie dubluje serii z serwera", async () => {
    let zakoncz!: (v: { ok: true; id: string }) => void;
    addSet.mockReturnValue(new Promise((r) => (zakoncz = r)));
    let dane: WorkoutData = daneTreningu();
    const { result, rerender } = renderHook(() => useGymStore(dane));
    act(() => {
      void result.current.addSet(WYCISKANIE);
    });
    // Odświeżenie po akcji przychodzi przed jej wynikiem i ma już serię w5
    dane = daneTreningu({
      sets: [
        ...daneTreningu().sets,
        seriaTreningu("w5", SESJA, WYCISKANIE, 1, 5, 72.5, 4, false),
      ],
    });
    rerender();
    await act(async () => zakoncz({ ok: true, id: "w5" }));
    expect(serieWyciskania(result).map((s) => s.id)).toEqual([
      "w1",
      "w2",
      "w3",
      "w4",
      "w5",
    ]);
  });

  it("„+ Seria”: tymczasowa seria dostaje id z serwera", async () => {
    addSet.mockResolvedValue({ ok: true, id: "w5" });
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    let obietnica!: Promise<void>;
    act(() => {
      obietnica = result.current.addSet(WYCISKANIE);
    });
    const tymczasowa = serieWyciskania(result)[4];
    expect(tymczasowa.id.startsWith("tmp-")).toBe(true);
    expect(tymczasowa).toMatchObject({ weight_kg: 72.5, reps: 4, done: false });
    await act(async () => obietnica);
    expect(serieWyciskania(result)[4].id).toBe("w5");
  });

  it("seria tymczasowa nie wysyła zmian, dopóki nie ma id z serwera", () => {
    addSet.mockReturnValue(new Promise(() => {}));
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    act(() => {
      void result.current.addSet(WYCISKANIE);
    });
    const id = serieWyciskania(result)[4].id;
    act(() => {
      void result.current.toggleDone(id);
      void result.current.deleteSet(id);
    });
    expect(updateSet).not.toHaveBeenCalled();
    expect(deleteSet).not.toHaveBeenCalled();
  });

  it("nowe ćwiczenie: 3 puste serie na końcu, po sukcesie z id ćwiczenia", async () => {
    addExercise.mockResolvedValue({ ok: true, id: "e-nowe" });
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    let obietnica!: Promise<void>;
    act(() => {
      obietnica = result.current.addExercise("Martwy ciąg");
    });
    const ostatnie = result.current.exercises.at(-1)!;
    expect(ostatnie.name).toBe("Martwy ciąg");
    expect(ostatnie.sets).toHaveLength(3);
    expect(
      ostatnie.sets.every((s) => s.weight_kg === null && s.reps === null),
    ).toBe(true);
    await act(async () => obietnica);
    expect(result.current.exercises.at(-1)).toMatchObject({
      id: "e-nowe",
      name: "Martwy ciąg",
    });
  });

  it("ćwiczenie dodane, gdy nowe dane już je zawierają, nie dubluje się", () => {
    addExercise.mockReturnValue(new Promise(() => {}));
    let dane: WorkoutData = daneTreningu();
    const { result, rerender } = renderHook(() => useGymStore(dane));
    act(() => {
      void result.current.addExercise("martwy ciąg");
    });
    dane = daneTreningu({
      exercises: [
        ...daneTreningu().exercises,
        {
          id: "e-nowe",
          user_id: "u1",
          name: "Martwy ciąg",
          muscle_group: "plecy",
          created_at: null,
          bodyweight: false,
          kind: null,
          equipment: null,
          note: null,
          rest_s: null,
        },
      ],
      sets: [
        ...daneTreningu().sets,
        seriaTreningu("m1", SESJA, "e-nowe", 3, 1, null, null, false),
      ],
    });
    rerender();
    expect(
      result.current.exercises.filter(
        (e) => e.name.toLowerCase() === "martwy ciąg",
      ),
    ).toHaveLength(1);
  });

  it("wyjątek akcji cofa usunięcie serii i pokazuje toast", async () => {
    deleteSet.mockRejectedValue(new Error("sieć"));
    const d = daneTreningu();
    const { result } = renderHook(() => useGymStore(d));
    await act(async () => result.current.deleteSet("w1"));
    expect(serieWyciskania(result)).toHaveLength(4);
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });
});
