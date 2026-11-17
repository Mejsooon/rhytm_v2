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

  it("nowe dane z serwera zastępują stan, także zmiany w toku", () => {
    let wejscie = dane();
    const { result, rerender } = renderHook(() => useCalendarStore(wejscie));
    act(() => {
      void result.current.applyOptimistic(ukryj, () => new Promise(() => {}));
    });
    expect(result.current.pending).toBe(1);

    wejscie = dane(false); // nowa tożsamość = nowe dane z serwera
    rerender();
    expect(result.current.data).toBe(wejscie);
    expect(result.current.pending).toBe(0);
  });
});
