import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError } = vi.hoisted(() => ({ toastError: vi.fn() }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { TaskRow } from "@/features/tasks/model";
import type { TodayData } from "./load-today";
import { useTodayStore, type TodayChange } from "./use-today-store";

function zadanie(id: string, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title: id,
    done,
    done_at: null,
    due_date: "2026-11-17",
    block_id: "b1",
    occurrence_date: "2026-11-17",
    position: 0,
    created_at: null,
  };
}

function dane(tasks: TaskRow[]): TodayData {
  return {
    profile: {
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      displayName: null,
      avatarPath: null,
      sleepGoalMin: 480,
      kmGoalOn: false,
      weeklyKmGoal: 25,
      workoutsGoalOn: false,
      weeklyWorkoutsGoal: 3,
    },
    today: "2026-11-17",
    nowMin: 600,
    weekStartDate: "2026-11-16",
    blocks: [],
    occurrencesToday: [],
    categories: [],
    tasks,
    habits: [],
    checks: new Map(),
    sleepLogs: [],
    sportItems: [],
  };
}

const odhacz: TodayChange = (d) => ({
  ...d,
  tasks: d.tasks.map((t) => (t.id === "t1" ? { ...t, done: true } : t)),
});

beforeEach(() => vi.clearAllMocks());

describe("useTodayStore", () => {
  it("zmiana jest widoczna od razu, a po sukcesie zostaje", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    // Stała tożsamość danych — nowe dane przy każdym renderze to „nowy serwer”
    const d = dane([zadanie("t1", false)]);
    const { result } = renderHook(() => useTodayStore(d));
    let obietnica: Promise<boolean> = Promise.resolve(false);
    act(() => {
      obietnica = result.current.applyOptimistic(
        odhacz,
        () => new Promise((r) => (zakoncz = r)),
      );
    });
    expect(result.current.data.tasks[0].done).toBe(true);
    await act(async () => {
      zakoncz({ ok: true });
      await obietnica;
    });
    expect(result.current.data.tasks[0].done).toBe(true);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("błąd akcji cofa zmianę i pokazuje toast", async () => {
    // Stała tożsamość danych — nowe dane przy każdym renderze to „nowy serwer”
    const d = dane([zadanie("t1", false)]);
    const { result } = renderHook(() => useTodayStore(d));
    let udane = true;
    await act(async () => {
      udane = await result.current.applyOptimistic(odhacz, async () => ({
        ok: false,
        message: "x",
      }));
    });
    expect(udane).toBe(false);
    expect(result.current.data.tasks[0].done).toBe(false);
    expect(toastError).toHaveBeenCalledWith(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });

  it("wyjątek akcji też cofa zmianę", async () => {
    // Stała tożsamość danych — nowe dane przy każdym renderze to „nowy serwer”
    const d = dane([zadanie("t1", false)]);
    const { result } = renderHook(() => useTodayStore(d));
    await act(async () => {
      await result.current.applyOptimistic(odhacz, async () => {
        throw new Error("sieć");
      });
    });
    expect(result.current.data.tasks[0].done).toBe(false);
    expect(toastError).toHaveBeenCalledTimes(1);
  });

  it("nowe dane z serwera zastępują bazę, a trwająca zmiana zostaje nałożona", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    const { result, rerender } = renderHook(
      ({ d }: { d: TodayData }) => useTodayStore(d),
      { initialProps: { d: dane([zadanie("t1", false)]) } },
    );
    act(() => {
      void result.current.applyOptimistic(
        odhacz,
        () => new Promise((r) => (zakoncz = r)),
      );
    });
    rerender({ d: dane([zadanie("t1", false), zadanie("t2", false)]) });
    expect(result.current.data.tasks.map((t) => [t.id, t.done])).toEqual([
      ["t1", true],
      ["t2", false],
    ]);
    await act(async () => zakoncz({ ok: true }));
  });
});
