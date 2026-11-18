import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError, setHabitCheck } = vi.hoisted(() => ({
  toastError: vi.fn(),
  setHabitCheck: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({ setHabitCheck }));

import type { HabitsPageData } from "./load-habits";
import { useHabitsStore } from "./use-habits-store";

function dane(checks: HabitsPageData["checks"] = []): HabitsPageData {
  return {
    today: "2026-11-17",
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 480,
    habits: [],
    checks,
    sleepLogs: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("useHabitsStore", () => {
  it("odhaczenie widać od razu, a sukces je zostawia", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    setHabitCheck.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const d = dane();
    const { result } = renderHook(() => useHabitsStore(d));

    act(() => {
      void result.current.toggle("h1", "2026-11-17");
    });
    expect(result.current.checks.get("h1")?.has("2026-11-17")).toBe(true);
    expect(setHabitCheck).toHaveBeenCalledWith("h1", "2026-11-17", true);

    await act(async () => zakoncz({ ok: true }));
    expect(result.current.checks.get("h1")?.has("2026-11-17")).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("odznaczenie wysyła done=false", () => {
    setHabitCheck.mockReturnValue(new Promise(() => {}));
    const d = dane([{ habitId: "h1", date: "2026-11-16" }]);
    const { result } = renderHook(() => useHabitsStore(d));
    act(() => {
      void result.current.toggle("h1", "2026-11-16");
    });
    expect(result.current.checks.get("h1")?.has("2026-11-16")).toBe(false);
    expect(setHabitCheck).toHaveBeenCalledWith("h1", "2026-11-16", false);
  });

  it("błąd akcji cofa zmianę i pokazuje toast", async () => {
    setHabitCheck.mockResolvedValue({ ok: false, message: "x" });
    const d = dane();
    const { result } = renderHook(() => useHabitsStore(d));
    await act(async () => result.current.toggle("h1", "2026-11-17"));
    expect(result.current.checks.get("h1")?.has("2026-11-17") ?? false).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
  });

  it("nowe dane z serwera zastępują bazę", () => {
    const { result, rerender } = renderHook(({ d }) => useHabitsStore(d), {
      initialProps: { d: dane() },
    });
    expect(result.current.checks.get("h1")).toBeUndefined();
    rerender({ d: dane([{ habitId: "h1", date: "2026-11-15" }]) });
    expect(result.current.checks.get("h1")?.has("2026-11-15")).toBe(true);
  });
});
