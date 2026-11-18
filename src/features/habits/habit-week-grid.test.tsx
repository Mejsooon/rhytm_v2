import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { HabitWeekGrid } from "./habit-week-grid";
import type { Checks, Habit } from "./model";

const DZIS = "2026-11-17"; // wtorek, tydzień 16–22.11

function nawyk(id: string, name: string, schedule: Habit["schedules"][number]): Habit {
  return { id, name, remindAt: null, showOnToday: true, createdAt: "", schedules: [schedule] };
}

const NAWYKI: Habit[] = [
  nawyk("h1", "Woda 2 l", { validFrom: "2026-11-01", type: "daily", weekdays: [], timesPerWeek: null }),
  // pn i śr; dziś (wt) niezaplanowany
  nawyk("h2", "Rozciąganie", { validFrom: "2026-11-01", type: "weekdays", weekdays: [1, 3], timesPerWeek: null }),
  // nowy od dziś: poniedziałek jest przed validFrom
  nawyk("h3", "Czytanie", { validFrom: DZIS, type: "daily", weekdays: [], timesPerWeek: null }),
  nawyk("h4", "Angielski", { validFrom: "2026-11-01", type: "times_per_week", weekdays: [], timesPerWeek: 4 }),
];

function wyrenderuj(checks: Checks = new Map(), onToggle = vi.fn(), habits = NAWYKI) {
  render(
    <HabitWeekGrid habits={habits} checks={checks} today={DZIS} weekStart="mon" onToggle={onToggle} onNewHabit={vi.fn()} />,
  );
  return onToggle;
}

const wiersz = (nazwa: string) => screen.getByRole("link", { name: nazwa }).closest("li") as HTMLElement;

describe("HabitWeekGrid", () => {
  it("komórka jutra i komórka przed validFrom są wyłączone", () => {
    wyrenderuj();
    expect(screen.getByRole("button", { name: /^Woda 2 l · 18\.11/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Czytanie · 16\.11/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /^Woda 2 l · 17\.11/ })).toBeEnabled();
  });

  it("przy weekdays dzień niezaplanowany to „–”, nie przycisk", () => {
    wyrenderuj();
    const r = wiersz("Rozciąganie");
    expect(within(r).getAllByText("–").length).toBeGreaterThan(0);
    expect(within(r).queryByRole("button", { name: /^Rozciąganie · 17\.11/ })).not.toBeInTheDocument();
    expect(within(r).getByRole("button", { name: /^Rozciąganie · 16\.11/ })).toBeEnabled();
  });

  it("osierocone odhaczenie w dniu niezaplanowanym da się odznaczyć", async () => {
    const onToggle = wyrenderuj(new Map([["h2", new Set(["2026-11-17"])]]));
    const komorka = screen.getByRole("button", { name: /^Rozciąganie · 17\.11/ });
    expect(komorka).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(komorka);
    expect(onToggle).toHaveBeenCalledWith("h2", "2026-11-17");
  });

  it("X/tydz. pokazuje postęp tygodnia i pozwala odhaczyć dowolny dzień", () => {
    wyrenderuj(new Map([["h4", new Set(["2026-11-16"])]]));
    expect(within(wiersz("Angielski")).getByText(/4× w tygodniu · seria .* · 1\/4/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Angielski · 17\.11/ })).toBeEnabled();
  });

  it("nazwa nawyku to link do szczegółów", () => {
    wyrenderuj();
    expect(screen.getByRole("link", { name: "Woda 2 l" })).toHaveAttribute("href", "/nawyki/h1");
  });

  it("bez nawyków pokazuje stan pusty", async () => {
    const onNewHabit = vi.fn();
    render(
      <HabitWeekGrid habits={[]} checks={new Map()} today={DZIS} weekStart="mon" onToggle={vi.fn()} onNewHabit={onNewHabit} />,
    );
    expect(screen.getByText("Nie masz jeszcze nawyków.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dodaj pierwszy nawyk" }));
    expect(onNewHabit).toHaveBeenCalled();
  });
});
