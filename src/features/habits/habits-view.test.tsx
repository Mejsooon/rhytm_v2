import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toastError, setHabitCheck } = vi.hoisted(() => ({
  toastError: vi.fn(),
  setHabitCheck: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("./actions", () => ({ setHabitCheck }));

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
});
