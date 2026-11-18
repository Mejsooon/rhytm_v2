import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock("./actions", () => ({
  deleteHabit: vi.fn(),
  addHabitNote: vi.fn(),
  updateHabit: vi.fn(),
  createHabit: vi.fn(),
}));

import { HabitDetail } from "./habit-detail";
import type { HabitDetailData } from "./load-habits";

function dane(): HabitDetailData {
  return {
    today: "2026-11-17",
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 480,
    habits: [
      {
        id: "h1",
        name: "Woda 2 l",
        remindAt: "20:00",
        showOnToday: true,
        createdAt: "",
        schedules: [
          {
            validFrom: "2026-11-01",
            type: "daily",
            weekdays: [],
            timesPerWeek: null,
          },
        ],
      },
    ],
    checks: [{ habitId: "h1", date: "2026-11-17" }],
    sleepLogs: [],
    notes: [],
  };
}

// Oba układy są w DOM (bez mocków drzewa telefonu), przełącza je CSS
describe("HabitDetail z oboma drzewami", () => {
  it("drzewa web i telefonu mają klasy widoczności i testid dla e2e", () => {
    render(<HabitDetail data={dane()} />);
    expect(screen.getByTestId("m-nawyk").className).toContain(
      "min-[800px]:hidden",
    );
    expect(screen.getByTestId("web-nawyk").className).toContain(
      "max-[799px]:hidden",
    );
    expect(
      within(screen.getByTestId("m-nawyk")).getByRole("heading", {
        level: 1,
        name: "Woda 2 l",
      }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByTestId("web-nawyk")).getByRole("heading", {
        level: 1,
        name: "Woda 2 l",
      }),
    ).toBeInTheDocument();
  });

  it("„Edytuj” na telefonie otwiera tylko arkusz telefonu (jedno okno)", async () => {
    render(<HabitDetail data={dane()} />);
    await userEvent.click(
      within(screen.getByTestId("m-nawyk")).getByRole("button", {
        name: "Edytuj",
      }),
    );
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    const okno = screen.getByRole("dialog", { name: "Edytuj nawyk" });
    // Arkusz telefonu: „Anuluj” / „Zapisz” w nagłówku, segment „Jak często”; bez webowego „Harmonogram”
    expect(
      within(okno).getByRole("radiogroup", { name: "Jak często" }),
    ).toBeInTheDocument();
    expect(
      within(okno).queryByRole("radiogroup", { name: "Harmonogram" }),
    ).not.toBeInTheDocument();
    expect(
      within(okno).queryByRole("button", { name: "Zamknij" }),
    ).not.toBeInTheDocument();
  });
});
