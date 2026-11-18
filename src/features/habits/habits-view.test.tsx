import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError, setHabitCheck, createHabit, updateHabit, saveSleepLog } = vi.hoisted(() => ({
  toastError: vi.fn(),
  setHabitCheck: vi.fn(),
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
  saveSleepLog: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({ setHabitCheck, createHabit, updateHabit, saveSleepLog }));

import { HabitsView } from "./habits-view";
import type { HabitsPageData } from "./load-habits";

function dane(): HabitsPageData {
  return {
    today: "2026-11-17",
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 480,
    habits: [
      {
        id: "h1",
        name: "Woda 2 l",
        remindAt: null,
        showOnToday: true,
        createdAt: "",
        schedules: [{ validFrom: "2026-11-01", type: "daily", weekdays: [], timesPerWeek: null }],
      },
      {
        id: "h2",
        name: "Czytanie 20 min",
        remindAt: null,
        showOnToday: true,
        createdAt: "",
        schedules: [{ validFrom: "2026-11-01", type: "daily", weekdays: [], timesPerWeek: null }],
      },
    ],
    checks: [{ habitId: "h1", date: "2026-11-17" }],
    sleepLogs: [],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("HabitsView", () => {
  it("nagłówek z datą i przyciskami", () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    expect(screen.getByRole("heading", { level: 1, name: "Nawyki i sen" })).toBeInTheDocument();
    expect(screen.getByText("wtorek · 17.11.2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Wpis snu" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nowy nawyk" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "+ Nowy nawyk" })).toBeInTheDocument();
  });

  it("odhaczenie dziś zmienia 1/2 na 2/2 przed odpowiedzią serwera", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    setHabitCheck.mockReturnValue(new Promise((r) => (zakoncz = r)));
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    expect(screen.getByText("1/2")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^Czytanie 20 min · 17\.11/ }));
    expect(screen.getByText("2/2")).toBeInTheDocument();
    expect(setHabitCheck).toHaveBeenCalledWith("h2", "2026-11-17", true);
    await act(async () => zakoncz({ ok: true }));
    expect(screen.getByText("2/2")).toBeInTheDocument();
  });

  it("błąd akcji cofa odhaczenie i woła toast", async () => {
    setHabitCheck.mockResolvedValue({ ok: false, message: "x" });
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Odhacz dziś: Czytanie 20 min" }));
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
  });

  it("Nowy nawyk otwiera okno nawyku, a Anuluj je zamyka", async () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Nowy nawyk" }));
    expect(screen.getByRole("dialog", { name: "Nowy nawyk" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("?nowy=nawyk otwiera okno nawyku od razu", () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad="nawyk" />);
    expect(screen.getByRole("dialog", { name: "Nowy nawyk" })).toBeInTheDocument();
  });

  it("?nowy=sen otwiera wpis snu na dziś", () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad="sen" />);
    expect(screen.getByRole("dialog", { name: "Noc z poniedziałku na wtorek" })).toBeInTheDocument();
  });

  it("+ Wpis snu dla dnia z wpisem otwiera okno z jego wartościami", async () => {
    const d = dane();
    d.sleepLogs = [
      { date: "2026-11-17", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: [], note: null },
    ];
    render(<HabitsView data={d} initialTab={null} openOnLoad={null} />);
    await userEvent.click(screen.getByRole("button", { name: "+ Wpis snu" }));
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent("23:48");
  });

  it("klik w „Ostatnia noc” otwiera okno edycji tego wpisu", async () => {
    const d = dane();
    d.sleepLogs = [
      { date: "2026-11-16", sleptAt: "22:30", wokeAt: "06:30", feeling: null, tags: [], note: null },
    ];
    render(<HabitsView data={d} initialTab={null} openOnLoad={null} />);
    await userEvent.click(screen.getByRole("button", { name: "Edytuj ostatnią noc" }));
    expect(screen.getByRole("dialog", { name: "Noc z niedzieli na poniedziałek" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zasnąłem" })).toHaveTextContent("22:30");
  });
});
