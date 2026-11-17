import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { CalendarData } from "./load-calendar";
import { useCalendarStore } from "./use-calendar-store";

function dane(hidden = false): CalendarData {
  return {
    blocks: [],
    exceptions: [],
    tasks: [],
    categories: [
      { id: "c1", name: "Studia", color: "#0070f3", hidden, is_system: false, position: 1, user_id: "u1", created_at: null },
    ],
    profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
  };
}

const ukryj = (d: CalendarData): CalendarData => ({
  ...d,
  categories: d.categories.map((c) => ({ ...c, hidden: true })),
});

beforeEach(() => vi.clearAllMocks());

describe("useCalendarStore", () => {
  it("zmiana optymistyczna jest widoczna od razu, zanim akcja się zakończy", async () => {
    const poczatkowe = dane();
    const { result } = renderHook(() => useCalendarStore(poczatkowe));
    let zakoncz!: (v: { ok: true }) => void;
    const akcja = () => new Promise<{ ok: true }>((r) => (zakoncz = r));

    let obietnica!: Promise<boolean>;
    act(() => {
      obietnica = result.current.applyOptimistic(ukryj, akcja);
    });
    expect(result.current.data.categories[0].hidden).toBe(true);
    expect(result.current.pending).toBe(1);

    await act(async () => {
      zakoncz({ ok: true });
      await obietnica;
    });
    expect(result.current.data.categories[0].hidden).toBe(true);
    expect(result.current.pending).toBe(0);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("po odrzuceniu akcji stan wraca i jest toast", async () => {
    const poczatkowe = dane();
    const { result } = renderHook(() => useCalendarStore(poczatkowe));
    await act(async () => {
      const ok = await result.current.applyOptimistic(ukryj, async () => ({
        ok: false as const,
        message: "x",
      }));
      expect(ok).toBe(false);
    });
    expect(result.current.data.categories[0].hidden).toBe(false);
    expect(result.current.pending).toBe(0);
    expect(toastError).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
  });

  it("wyjątek rzucony przez akcję też cofa zmianę", async () => {
    const poczatkowe = dane();
    const { result } = renderHook(() => useCalendarStore(poczatkowe));
    await act(async () => {
      await result.current.applyOptimistic(ukryj, async () => {
        throw new Error("sieć");
      });
    });
    expect(result.current.data.categories[0].hidden).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("nowe dane z serwera zostawiają zmiany w toku, aż ich akcje się zakończą", async () => {
    const dwie = (hidden1: boolean): CalendarData => {
      const d = dane(hidden1);
      return {
        ...d,
        categories: [
          d.categories[0],
          { ...d.categories[0], id: "c2", name: "Dom", hidden: false },
        ],
      };
    };
    const ukryjId = (id: string) => (d: CalendarData): CalendarData => ({
      ...d,
      categories: d.categories.map((c) => (c.id === id ? { ...c, hidden: true } : c)),
    });
    let wejscie = dwie(false);
    const { result, rerender } = renderHook(() => useCalendarStore(wejscie));
    let koniec1!: (v: { ok: true }) => void;
    let koniec2!: (v: { ok: true }) => void;
    let p1!: Promise<boolean>;
    let p2!: Promise<boolean>;
    act(() => {
      p1 = result.current.applyOptimistic(ukryjId("c1"), () => new Promise((r) => (koniec1 = r)));
      p2 = result.current.applyOptimistic(ukryjId("c2"), () => new Promise((r) => (koniec2 = r)));
    });
    expect(result.current.pending).toBe(2);

    // Pierwsza akcja się kończy i serwer wysyła nowe dane (c1 już ukryta)
    await act(async () => {
      koniec1({ ok: true });
      await p1;
    });
    wejscie = dwie(true);
    rerender();
    expect(result.current.data.categories[0].hidden).toBe(true);
    // Druga zmiana nadal widoczna, choć dane serwera jej jeszcze nie mają
    expect(result.current.data.categories[1].hidden).toBe(true);
    expect(result.current.pending).toBe(1);

    await act(async () => {
      koniec2({ ok: true });
      await p2;
    });
    expect(result.current.pending).toBe(0);

    // Odświeżenie wywołane przez tę akcję przynosi dane z obiema zmianami
    wejscie = { ...dwie(true), categories: dwie(true).categories.map((c) => ({ ...c, hidden: true })) };
    rerender();
    expect(result.current.data.categories[1].hidden).toBe(true);
  });

  it("zmiana w toku przeżywa nowe dane, a po błędzie jej akcji znika", async () => {
    let wejscie = dane();
    const { result, rerender } = renderHook(() => useCalendarStore(wejscie));
    let blad!: (v: { ok: false; message: string }) => void;
    let p!: Promise<boolean>;
    act(() => {
      p = result.current.applyOptimistic(ukryj, () => new Promise((r) => (blad = r)));
    });
    wejscie = dane(false); // nowa tożsamość
    rerender();
    expect(result.current.data.categories[0].hidden).toBe(true);
    expect(result.current.pending).toBe(1);

    await act(async () => {
      blad({ ok: false, message: "x" });
      await p;
    });
    expect(result.current.data.categories[0].hidden).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
  });
});
