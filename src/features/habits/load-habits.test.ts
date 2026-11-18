import { describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";
import { loadHabitDetail, loadHabitsPage } from "./load-habits";

const NAWYK = "a1000000-0000-4000-8000-000000000001";

function klient(tables: Record<string, ReturnType<typeof fakeTable>>) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- atrapa klienta
  return { from: (nazwa: string) => tables[nazwa] } as any;
}

function tabele() {
  return {
    profiles: fakeTable({
      single: { timezone: "Europe/Warsaw", week_start: "sun", clock: "12", sleep_goal_min: 450 },
    }),
    habits: fakeTable({
      data: [
        { id: NAWYK, name: "Czytanie", remind_at: "07:30:00", show_on_today: true, created_at: "2026-10-01T10:00:00Z" },
      ],
      single: { id: NAWYK, name: "Czytanie", remind_at: "07:30:00", show_on_today: true, created_at: "2026-10-01T10:00:00Z" },
    }),
    // celowo w złej kolejności
    habit_schedules: fakeTable({
      data: [
        { habit_id: NAWYK, valid_from: "2026-11-10", schedule_type: "weekdays", weekdays: [1, 3], times_per_week: null },
        { habit_id: NAWYK, valid_from: "2026-10-01", schedule_type: "daily", weekdays: [], times_per_week: null },
      ],
    }),
    habit_checks: fakeTable({ data: [{ habit_id: NAWYK, date: "2026-11-17" }] }),
    habit_notes: fakeTable({ data: [{ id: "n1", date: "2026-11-17", text: "Dobrze poszło" }] }),
    sleep_logs: fakeTable({
      data: [{ date: "2026-11-18", slept_at: "23:30:00", woke_at: "07:00:00", feeling: 4, tags: ["Stres"], note: null }],
    }),
  };
}

describe("loadHabitsPage", () => {
  it("składa wersje rosnąco i mapuje kolumny", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const t = tabele();
    const w = await loadHabitsPage(klient(t), "u1");
    vi.useRealTimers();

    expect(w.today).toBe("2026-11-18");
    expect(w.weekStart).toBe("sun");
    expect(w.clock).toBe("12");
    expect(w.sleepGoalMin).toBe(450);
    expect(w.habits).toHaveLength(1);
    expect(w.habits[0]).toMatchObject({ id: NAWYK, name: "Czytanie", remindAt: "07:30", showOnToday: true });
    expect(w.habits[0].schedules).toEqual([
      { validFrom: "2026-10-01", type: "daily", weekdays: [], timesPerWeek: null },
      { validFrom: "2026-11-10", type: "weekdays", weekdays: [1, 3], timesPerWeek: null },
    ]);
    expect(w.checks).toEqual([{ habitId: NAWYK, date: "2026-11-17" }]);
    expect(w.sleepLogs).toEqual([
      { date: "2026-11-18", sleptAt: "23:30", wokeAt: "07:00", feeling: 4, tags: ["Stres"], note: null },
    ]);
  });

  it("okna dat: odhaczenia z całej historii (serie jak na stronie szczegółów), sen 60 dni", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T10:00:00Z"));
    const t = tabele();
    await loadHabitsPage(klient(t), "u1");
    vi.useRealTimers();
    expect(t.habit_checks.gte).not.toHaveBeenCalled();
    expect(t.habit_checks.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(t.sleep_logs.gte).toHaveBeenCalledWith("date", "2026-09-19");
  });

  it("scala odhaczenia z dwóch stron (po 1000 wierszy)", async () => {
    const t = tabele();
    const strona1 = Array.from({ length: 1000 }, (_, i) => ({ habit_id: NAWYK, date: `d${i}` }));
    t.habit_checks = fakeTable({ pages: [strona1, [{ habit_id: NAWYK, date: "d1000" }]] });
    const w = await loadHabitsPage(klient(t), "u1");
    expect(w.checks).toHaveLength(1001);
    expect(t.habit_checks.range).toHaveBeenNthCalledWith(1, 0, 999);
    expect(t.habit_checks.range).toHaveBeenNthCalledWith(2, 1000, 1999);
    expect(t.habit_checks.range).toHaveBeenCalledTimes(2);
  });

  it("strefa: 23:30 UTC w Warszawie to już następny dzień", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-18T23:30:00Z"));
    const w = await loadHabitsPage(klient(tabele()), "u1");
    vi.useRealTimers();
    expect(w.today).toBe("2026-11-19");
  });

  it("domyślne wartości profilu i celu snu 480", async () => {
    const t = tabele();
    t.profiles = fakeTable({ single: null });
    const w = await loadHabitsPage(klient(t), "u1");
    expect(w.weekStart).toBe("mon");
    expect(w.clock).toBe("24");
    expect(w.sleepGoalMin).toBe(480);
  });

  it("błąd zapytania rzuca wyjątek", async () => {
    const t = tabele();
    t.habits = fakeTable({ error: { message: "boom" } });
    await expect(loadHabitsPage(klient(t), "u1")).rejects.toThrow("boom");
  });
});

describe("loadHabitDetail", () => {
  it("zwraca nawyk z notatkami", async () => {
    const w = await loadHabitDetail(klient(tabele()), "u1", NAWYK);
    expect(w?.habits).toHaveLength(1);
    expect(w?.notes).toEqual([{ id: "n1", date: "2026-11-17", text: "Dobrze poszło" }]);
  });

  it("odhaczenia szczegółów też są stronicowane", async () => {
    const t = tabele();
    const strona1 = Array.from({ length: 1000 }, (_, i) => ({ habit_id: NAWYK, date: `d${i}` }));
    t.habit_checks = fakeTable({ pages: [strona1, []] });
    const w = await loadHabitDetail(klient(t), "u1", NAWYK);
    expect(w?.checks).toHaveLength(1000);
    expect(t.habit_checks.range).toHaveBeenCalledTimes(2);
  });

  it("null, gdy nawyku nie ma albo id jest nieprawidłowe", async () => {
    const t = tabele();
    t.habits = fakeTable({ single: null });
    expect(await loadHabitDetail(klient(t), "u1", NAWYK)).toBeNull();
    expect(await loadHabitDetail(klient(tabele()), "u1", "nie-uuid")).toBeNull();
  });
});
