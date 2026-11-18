import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath }));

import {
  addHabitNote,
  createHabit,
  deleteHabit,
  saveSleepLog,
  setHabitCheck,
  updateHabit,
} from "./actions";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";
const NAWYK = "a1000000-0000-4000-8000-000000000001";

const wejscie = {
  name: "Czytanie",
  schedule: { type: "daily" as const, weekdays: [], timesPerWeek: null },
  remindAt: null,
  showOnToday: true,
};

const sen = {
  date: "2026-11-18",
  sleptAt: "23:30",
  wokeAt: "07:00",
  feeling: 4 as const,
  tags: ["Stres"],
  note: null,
};

// Obowiązująca dziś wersja: codziennie od 1 października
const wersjaDaily = {
  habit_id: NAWYK,
  valid_from: "2026-10-01",
  schedule_type: "daily",
  weekdays: [],
  times_per_week: null,
};

let tables: Record<string, ReturnType<typeof fakeTable>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-18T10:00:00Z")); // środa
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  tables = {
    profiles: fakeTable({ single: { timezone: "Europe/Warsaw" } }),
    habits: fakeTable({
      data: [{ id: NAWYK }],
      single: { id: NAWYK, name: "Czytanie", remind_at: null, show_on_today: true, created_at: null },
    }),
    habit_schedules: fakeTable({ data: [wersjaDaily] }),
    habit_checks: fakeTable(),
    habit_notes: fakeTable(),
    sleep_logs: fakeTable(),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createHabit", () => {
  it("bez sesji przekierowuje na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(createHabit(wejscie)).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("pusta nazwa → ok: false, bez insert", async () => {
    const w = await createHabit({ ...wejscie, name: " " });
    expect(w.ok).toBe(false);
    expect(tables.habits.insert).not.toHaveBeenCalled();
  });

  it("wstawia nawyk i pierwszą wersję z valid_from = dziś", async () => {
    tables.habits = fakeTable({ single: { id: NAWYK } });
    const w = await createHabit(wejscie);
    expect(w).toEqual({ ok: true, id: NAWYK });
    expect(tables.habit_schedules.insert).toHaveBeenCalledWith({
      habit_id: NAWYK,
      user_id: "u1",
      valid_from: "2026-11-18",
      schedule_type: "daily",
      weekdays: [],
      times_per_week: null,
    });
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("„Wybrane dni” z 7 dniami zapisuje daily", async () => {
    tables.habits = fakeTable({ single: { id: NAWYK } });
    await createHabit({
      ...wejscie,
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7], timesPerWeek: null },
    });
    expect(tables.habit_schedules.insert).toHaveBeenCalledWith(
      expect.objectContaining({ schedule_type: "daily", weekdays: [] }),
    );
  });

  it("błąd zapisu wersji cofa nawyk", async () => {
    tables.habits = fakeTable({ single: { id: NAWYK } });
    tables.habit_schedules = fakeTable({ error: { message: "x" } });
    const w = await createHabit(wejscie);
    expect(w).toEqual({ ok: false, message: BLAD });
    expect(tables.habits.delete).toHaveBeenCalled();
  });
});

describe("updateHabit", () => {
  it("zmiana samej nazwy nie wstawia wersji", async () => {
    const w = await updateHabit(NAWYK, { ...wejscie, name: "Czytanie książek" });
    expect(w).toEqual({ ok: true });
    expect(tables.habits.update).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Czytanie książek" }),
    );
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
    expect(tables.habit_schedules.insert).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki/[id]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("zmiana dni wstawia wersję z valid_from = dziś i onConflict", async () => {
    const w = await updateHabit(NAWYK, {
      ...wejscie,
      schedule: { type: "weekdays", weekdays: [1, 3], timesPerWeek: null },
    });
    expect(w).toEqual({ ok: true });
    expect(tables.habit_schedules.upsert).toHaveBeenCalledWith(
      {
        habit_id: NAWYK,
        user_id: "u1",
        valid_from: "2026-11-18",
        schedule_type: "weekdays",
        weekdays: [1, 3],
        times_per_week: null,
      },
      { onConflict: "habit_id,valid_from" },
    );
  });

  it("„Wybrane dni” z 7 dniami przy obowiązującym daily nie tworzy wersji", async () => {
    await updateHabit(NAWYK, {
      ...wejscie,
      schedule: { type: "weekdays", weekdays: [1, 2, 3, 4, 5, 6, 7], timesPerWeek: null },
    });
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
  });

  it("nieistniejący nawyk (0 zmienionych wierszy) → ok: false", async () => {
    tables.habits = fakeTable({ data: [] });
    const w = await updateHabit(NAWYK, wejscie);
    expect(w).toEqual({ ok: false, message: BLAD });
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
  });
});

describe("deleteHabit", () => {
  it("usuwa i odświeża widoki", async () => {
    expect(await deleteHabit(NAWYK)).toEqual({ ok: true });
    expect(tables.habits.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("0 usuniętych wierszy → ok: false", async () => {
    tables.habits = fakeTable({ data: [] });
    expect((await deleteHabit(NAWYK)).ok).toBe(false);
  });

  it("nieprawidłowe id → ok: false", async () => {
    expect((await deleteHabit("x")).ok).toBe(false);
    expect(tables.habits.delete).not.toHaveBeenCalled();
  });
});

describe("setHabitCheck", () => {
  beforeEach(() => {
    tables.habit_schedules = fakeTable({ data: [wersjaDaily] });
  });

  it("jutro → ok: false, bez zapisu", async () => {
    const w = await setHabitCheck(NAWYK, "2026-11-19", true);
    expect(w.ok).toBe(false);
    expect(tables.habit_checks.upsert).not.toHaveBeenCalled();
    expect(tables.habit_checks.insert).not.toHaveBeenCalled();
  });

  it("data przed pierwszą wersją → ok: false", async () => {
    expect((await setHabitCheck(NAWYK, "2026-09-30", true)).ok).toBe(false);
  });

  it("dzień niezaplanowany przy weekdays → ok: false", async () => {
    tables.habit_schedules = fakeTable({
      data: [{ ...wersjaDaily, schedule_type: "weekdays", weekdays: [1] }],
    });
    // 2026-11-17 to wtorek
    expect((await setHabitCheck(NAWYK, "2026-11-17", true)).ok).toBe(false);
  });

  it("odhaczenie ignoruje duplikat", async () => {
    const w = await setHabitCheck(NAWYK, "2026-11-17", true);
    expect(w).toEqual({ ok: true });
    expect(tables.habit_checks.upsert).toHaveBeenCalledWith(
      { habit_id: NAWYK, user_id: "u1", date: "2026-11-17" },
      { onConflict: "habit_id,date", ignoreDuplicates: true },
    );
  });

  it("odznaczenie usuwa wiersz", async () => {
    const w = await setHabitCheck(NAWYK, "2026-11-17", false);
    expect(w).toEqual({ ok: true });
    expect(tables.habit_checks.delete).toHaveBeenCalled();
    expect(tables.habit_checks.upsert).not.toHaveBeenCalled();
  });

  it("cudzy albo nieistniejący nawyk → ok: false", async () => {
    tables.habits = fakeTable({ single: null });
    expect((await setHabitCheck(NAWYK, "2026-11-17", true)).ok).toBe(false);
  });
});

describe("addHabitNote", () => {
  it("wstawia notatkę z dzisiejszą datą", async () => {
    const w = await addHabitNote(NAWYK, "  Dobrze poszło ");
    expect(w).toEqual({ ok: true });
    expect(tables.habit_notes.insert).toHaveBeenCalledWith({
      habit_id: NAWYK,
      user_id: "u1",
      date: "2026-11-18",
      text: "Dobrze poszło",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki/[id]", "page");
  });

  it("pusta notatka → ok: false", async () => {
    expect((await addHabitNote(NAWYK, "  ")).ok).toBe(false);
    expect(tables.habit_notes.insert).not.toHaveBeenCalled();
  });
});

describe("saveSleepLog", () => {
  it("dwa razy z tą samą datą robi upsert na user_id,date, nie insert", async () => {
    expect(await saveSleepLog(sen)).toEqual({ ok: true });
    expect(await saveSleepLog({ ...sen, wokeAt: "07:30" })).toEqual({ ok: true });
    expect(tables.sleep_logs.insert).not.toHaveBeenCalled();
    expect(tables.sleep_logs.upsert).toHaveBeenCalledTimes(2);
    const [wiersz, opcje] = tables.sleep_logs.upsert.mock.calls[0];
    expect(opcje).toEqual({ onConflict: "user_id,date" });
    expect(wiersz).toMatchObject({
      user_id: "u1",
      date: "2026-11-18",
      slept_at: "23:30",
      woke_at: "07:00",
      feeling: 4,
      tags: ["Stres"],
      note: null,
    });
    expect(typeof wiersz.updated_at).toBe("string");
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
  });

  it("równe godziny → komunikat, bez upsert", async () => {
    const w = await saveSleepLog({ ...sen, wokeAt: "23:30" });
    expect(w).toEqual({ ok: false, message: "Godziny zaśnięcia i pobudki muszą się różnić." });
    expect(tables.sleep_logs.upsert).not.toHaveBeenCalled();
  });

  it("nieznany tag → ok: false", async () => {
    expect((await saveSleepLog({ ...sen, tags: ["Pizza"] })).ok).toBe(false);
  });

  it("błąd bazy → ok: false", async () => {
    tables.sleep_logs = fakeTable({ error: { message: "x" } });
    expect(await saveSleepLog(sen)).toEqual({ ok: false, message: BLAD });
  });
});
