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
const BRAK = "Nie znaleziono nawyku.";
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

describe("createHabit — cofnięcie", () => {
  it("błąd samego cofnięcia daje osobny komunikat", async () => {
    tables.habits = fakeTable({ single: { id: NAWYK } });
    tables.habits.delete = vi.fn(() => ({
      eq: () => Promise.resolve({ data: null, error: { message: "y" } }),
    }));
    tables.habit_schedules = fakeTable({ error: { message: "x" } });
    const w = await createHabit(wejscie);
    expect(w.ok).toBe(false);
    expect(w).not.toEqual({ ok: false, message: BLAD });
  });
});

describe("strefa czasowa", () => {
  beforeEach(() => {
    // 23:30 UTC w środę = 00:30 w czwartek w Warszawie
    vi.setSystemTime(new Date("2026-11-18T23:30:00Z"));
  });

  it("createHabit liczy valid_from w strefie profilu", async () => {
    tables.habits = fakeTable({ single: { id: NAWYK } });
    await createHabit(wejscie);
    expect(tables.habit_schedules.insert).toHaveBeenCalledWith(
      expect.objectContaining({ valid_from: "2026-11-19" }),
    );
  });

  it("setHabitCheck przyjmuje dzień, który w UTC jest jeszcze jutrem", async () => {
    tables.habit_schedules = fakeTable({ data: [{ ...wersjaDaily, valid_from: "2026-10-01" }] });
    expect(await setHabitCheck(NAWYK, "2026-11-19", true)).toEqual({ ok: true });
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
    expect(tables.habits.eq).toHaveBeenCalledWith("id", NAWYK);
    expect(tables.habits.eq).toHaveBeenCalledWith("user_id", "u1");
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

  it("zmiana samego X tworzy wersję", async () => {
    tables.habit_schedules = fakeTable({
      data: [{ ...wersjaDaily, schedule_type: "times_per_week", times_per_week: 3 }],
    });
    await updateHabit(NAWYK, {
      ...wejscie,
      schedule: { type: "times_per_week", weekdays: [], timesPerWeek: 4 },
    });
    expect(tables.habit_schedules.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ schedule_type: "times_per_week", times_per_week: 4, valid_from: "2026-11-18" }),
      { onConflict: "habit_id,valid_from" },
    );
  });

  it("niezmienione X nie tworzy wersji", async () => {
    tables.habit_schedules = fakeTable({
      data: [{ ...wersjaDaily, schedule_type: "times_per_week", times_per_week: 3 }],
    });
    await updateHabit(NAWYK, {
      ...wejscie,
      schedule: { type: "times_per_week", weekdays: [], timesPerWeek: 3 },
    });
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
  });

  it("zmiana samego typu (daily → times_per_week) tworzy wersję", async () => {
    await updateHabit(NAWYK, {
      ...wejscie,
      schedule: { type: "times_per_week", weekdays: [], timesPerWeek: 3 },
    });
    expect(tables.habit_schedules.upsert).toHaveBeenCalledTimes(1);
  });

  it("powrót do wersji sprzed dziś usuwa dzisiejszą wersję zamiast dublować", async () => {
    // daily od 01.10, dziś (18.11) już zmienione na pn/śr; użytkownik wraca do daily
    tables.habit_schedules = fakeTable({
      data: [
        wersjaDaily,
        { ...wersjaDaily, valid_from: "2026-11-18", schedule_type: "weekdays", weekdays: [1, 3] },
      ],
    });
    const w = await updateHabit(NAWYK, wejscie);
    expect(w).toEqual({ ok: true });
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
    expect(tables.habit_schedules.delete).toHaveBeenCalledTimes(1);
    expect(tables.habit_schedules.eq).toHaveBeenCalledWith("habit_id", NAWYK);
    expect(tables.habit_schedules.eq).toHaveBeenCalledWith("valid_from", "2026-11-18");
  });

  it("nawyk utworzony dziś: zmiana nadpisuje dzisiejszą wersję (nie ma czego przywracać)", async () => {
    tables.habit_schedules = fakeTable({
      data: [{ ...wersjaDaily, valid_from: "2026-11-18", schedule_type: "weekdays", weekdays: [1, 3] }],
    });
    await updateHabit(NAWYK, wejscie);
    expect(tables.habit_schedules.delete).not.toHaveBeenCalled();
    expect(tables.habit_schedules.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ valid_from: "2026-11-18", schedule_type: "daily" }),
      { onConflict: "habit_id,valid_from" },
    );
  });

  it("błąd usunięcia dzisiejszej wersji → ok: false", async () => {
    tables.habit_schedules = fakeTable({
      data: [
        wersjaDaily,
        { ...wersjaDaily, valid_from: "2026-11-18", schedule_type: "weekdays", weekdays: [1, 3] },
      ],
    });
    // pierwsze zapytanie (lista wersji) się udaje, usunięcie zwraca błąd
    tables.habit_schedules.delete = vi.fn(() => ({
      eq: () => ({ eq: () => Promise.resolve({ error: { message: "x" } }) }),
    }));
    expect(await updateHabit(NAWYK, wejscie)).toEqual({ ok: false, message: BLAD });
  });

  it("nieistniejący nawyk (0 zmienionych wierszy) → ok: false", async () => {
    tables.habits = fakeTable({ data: [] });
    const w = await updateHabit(NAWYK, wejscie);
    expect(w).toEqual({ ok: false, message: BRAK });
    expect(tables.habit_schedules.upsert).not.toHaveBeenCalled();
  });
});

describe("deleteHabit", () => {
  it("usuwa i odświeża widoki", async () => {
    expect(await deleteHabit(NAWYK)).toEqual({ ok: true });
    expect(tables.habits.delete).toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
    expect(revalidatePath).not.toHaveBeenCalledWith("/nawyki/[id]", "page");
  });

  it("0 usuniętych wierszy → ok: false", async () => {
    tables.habits = fakeTable({ data: [] });
    expect(await deleteHabit(NAWYK)).toEqual({ ok: false, message: BRAK });
  });

  it("zawęża usunięcie do id i user_id", async () => {
    await deleteHabit(NAWYK);
    expect(tables.habits.eq).toHaveBeenCalledWith("id", NAWYK);
    expect(tables.habits.eq).toHaveBeenCalledWith("user_id", "u1");
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
    expect(await setHabitCheck(NAWYK, "2026-11-17", true)).toEqual({ ok: false, message: BRAK });
  });

  it("błąd bazy przy wczytaniu nawyku to ogólny błąd zapisu", async () => {
    tables.habits = fakeTable({ error: { message: "x" } });
    expect(await setHabitCheck(NAWYK, "2026-11-17", true)).toEqual({ ok: false, message: BLAD });
  });

  it("odznaczenie dnia niezaplanowanego (osierocone odhaczenie) jest dozwolone", async () => {
    tables.habit_schedules = fakeTable({
      data: [{ ...wersjaDaily, schedule_type: "weekdays", weekdays: [1] }],
    });
    expect(await setHabitCheck(NAWYK, "2026-11-17", false)).toEqual({ ok: true });
    expect(tables.habit_checks.delete).toHaveBeenCalled();
  });

  it("odznaczenie jutra → ok: false", async () => {
    expect((await setHabitCheck(NAWYK, "2026-11-19", false)).ok).toBe(false);
    expect(tables.habit_checks.delete).not.toHaveBeenCalled();
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
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("cudzy nawyk → „Nie znaleziono nawyku.”", async () => {
    tables.habits = fakeTable({ single: null });
    expect(await addHabitNote(NAWYK, "x")).toEqual({ ok: false, message: BRAK });
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

  it("data z przyszłości → komunikat, bez upsert", async () => {
    const w = await saveSleepLog({ ...sen, date: "2026-11-19" });
    expect(w).toEqual({ ok: false, message: "Nie można zapisać snu z przyszłości." });
    expect(tables.sleep_logs.upsert).not.toHaveBeenCalled();
  });

  it("odświeża też stronę szczegółów nawyku", async () => {
    await saveSleepLog(sen);
    expect(revalidatePath).toHaveBeenCalledWith("/nawyki/[id]", "page");
    expect(revalidatePath).toHaveBeenCalledWith("/dzis");
  });

  it("błąd profilu → ogólny błąd, bez upsert", async () => {
    tables.profiles = fakeTable({ error: { message: "x" } });
    expect(await saveSleepLog(sen)).toEqual({ ok: false, message: BLAD });
    expect(tables.sleep_logs.upsert).not.toHaveBeenCalled();
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
