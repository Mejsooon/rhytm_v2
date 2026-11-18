import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replace, setHabitCheck } = vi.hoisted(() => ({ replace: vi.fn(), setHabitCheck: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("./actions", () => ({ setHabitCheck, createHabit: vi.fn(), updateHabit: vi.fn(), saveSleepLog: vi.fn() }));

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

// Drzewo telefonu (oba układy są w DOM, przełącza je CSS)
function telefon() {
  return screen.getByTestId("m-nawyki");
}

// Udajemy szerokość telefonu dla matchMedia (jsdom jej nie ma)
function ustawTelefon(tel: boolean) {
  window.matchMedia = vi.fn().mockReturnValue({ matches: tel }) as unknown as typeof window.matchMedia;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => {
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("HabitsView na telefonie", () => {
  it("oba układy w DOM, przełączane klasami 800 px", () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    expect(telefon().className).toContain("min-[800px]:hidden");
    expect(screen.getByTestId("web-nawyki").className).toContain("max-[799px]:hidden");
  });

  it("checkbox na telefonie odhacza optymistycznie przez wspólny store", async () => {
    let zakoncz!: (v: { ok: true }) => void;
    setHabitCheck.mockReturnValue(new Promise((r) => (zakoncz = r)));
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    expect(within(telefon()).getByText("1 z 2 zrobione dziś")).toBeInTheDocument();
    await userEvent.click(within(telefon()).getByRole("checkbox", { name: "Czytanie 20 min" }));
    expect(within(telefon()).getByText("2 z 2 zrobione dziś")).toBeInTheDocument();
    expect(setHabitCheck).toHaveBeenCalledWith("h2", "2026-11-17", true);
    await act(async () => zakoncz({ ok: true }));
  });

  it("„+” na telefonie otwiera arkusz (Zapisz w nagłówku), nie okno web", async () => {
    render(<HabitsView data={dane()} initialTab={null} openOnLoad={null} />);
    await userEvent.click(within(telefon()).getByRole("button", { name: "Nowy nawyk" }));
    const okno = screen.getByRole("dialog", { name: "Nowy nawyk" });
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
    expect(within(okno).queryByRole("button", { name: "Dodaj nawyk" })).not.toBeInTheDocument();
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("„Dodaj wpis snu” otwiera arkusz snu na dziś", async () => {
    render(<HabitsView data={dane()} initialTab="sen" openOnLoad={null} />);
    await userEvent.click(within(telefon()).getByRole("button", { name: "Dodaj wpis snu" }));
    const okno = screen.getByRole("dialog", { name: "Wpis snu" });
    expect(within(okno).getByText("Noc 16 → 17 listopada")).toBeInTheDocument();
  });

  it("?nowy=nawyk poniżej 800 px otwiera arkusz telefonu", () => {
    ustawTelefon(true);
    render(<HabitsView data={dane()} initialTab={null} openOnLoad="nawyk" />);
    const okno = screen.getByRole("dialog", { name: "Nowy nawyk" });
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
    expect(window.matchMedia).toHaveBeenCalledWith("(max-width: 799px)");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
  });

  it("?nowy=sen od 800 px otwiera okno web", () => {
    ustawTelefon(false);
    render(<HabitsView data={dane()} initialTab={null} openOnLoad="sen" />);
    expect(screen.getByText("Noc z poniedziałku na wtorek")).toBeInTheDocument();
  });

  it("?nowy=sen poniżej 800 px otwiera arkusz snu", () => {
    ustawTelefon(true);
    render(<HabitsView data={dane()} initialTab="sen" openOnLoad="sen" />);
    expect(screen.getByText("Noc 16 → 17 listopada")).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/nawyki?tab=sen");
  });
});
