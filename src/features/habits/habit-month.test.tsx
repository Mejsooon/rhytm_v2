import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HabitMonth } from "./habit-month";
import type { Habit, ScheduleVersion } from "./model";

function nawyk(schedules: ScheduleVersion[]): Habit {
  return { id: "h", name: "N", remindAt: null, showOnToday: true, createdAt: "", schedules };
}
const codziennie = (validFrom: string): ScheduleVersion => ({ validFrom, type: "daily", weekdays: [], timesPerWeek: null });

function stan(date: string) {
  return document.querySelector(`[data-day="${date}"]`)?.getAttribute("data-state");
}

describe("HabitMonth", () => {
  it("minMonth ogranicza cofanie, ale nie poniżej miesiąca startu", async () => {
    const { unmount } = render(
      <HabitMonth habit={nawyk([codziennie("2026-01-05")])} checks={new Set()} today="2026-11-17" weekStart="mon" minMonth="2026-06" maxMonth="2026-11" />,
    );
    const wstecz = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    for (let i = 0; i < 5; i++) await userEvent.click(wstecz);
    expect(screen.getByRole("heading", { name: "Czerwiec 2026" })).toBeInTheDocument();
    expect(wstecz).toBeDisabled();
    unmount();

    // start nawyku późniejszy niż minMonth wygrywa
    render(<HabitMonth habit={nawyk([codziennie("2026-09-10")])} checks={new Set()} today="2026-11-17" weekStart="mon" minMonth="2026-06" maxMonth="2026-11" />);
    const w2 = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    await userEvent.click(w2);
    await userEvent.click(w2);
    expect(screen.getByRole("heading", { name: "Wrzesień 2026" })).toBeInTheDocument();
    expect(w2).toBeDisabled();
  });

  it("weekStart sun: nagłówek od nd, 1.11.2026 (niedziela) w pierwszej kolumnie", () => {
    render(<HabitMonth habit={nawyk([codziennie("2026-10-01")])} checks={new Set()} today="2026-11-17" weekStart="sun" maxMonth="2026-11" />);
    const naglowek = Array.from(document.querySelectorAll(".mb-1 > span")).map((e) => e.textContent);
    expect(naglowek).toEqual(["nd", "pn", "wt", "śr", "cz", "pt", "sb"]);
    const komorki = Array.from(document.querySelectorAll("[data-day]"));
    expect(komorki[0].getAttribute("data-day")).toBe("2026-11-01");
  });

  it("miesiąc potrzebujący 6 rzędów (sierpień 2026, start pn) ma 42 komórki", () => {
    render(<HabitMonth habit={nawyk([codziennie("2026-01-01")])} checks={new Set()} today="2026-08-31" weekStart="mon" maxMonth="2026-08" />);
    expect(document.querySelectorAll("[data-day]")).toHaveLength(42);
    expect(stan("2026-08-30")).toBe("pominiete");
  });

  it("dziś zaplanowane i nieodhaczone jest neutralne, wczoraj pominięte", () => {
    render(<HabitMonth habit={nawyk([codziennie("2026-11-01")])} checks={new Set()} today="2026-11-17" weekStart="mon" maxMonth="2026-11" />);
    expect(stan("2026-11-17")).toBe("neutralne");
    expect(stan("2026-11-16")).toBe("pominiete");
    expect(stan("2026-11-18")).toBe("przyszlosc");
  });

  it("dzień przed późniejszą wersją używa wcześniejszej (nie jest szary)", () => {
    const habit = nawyk([
      codziennie("2026-10-01"),
      { validFrom: "2026-11-10", type: "weekdays", weekdays: [1], timesPerWeek: null },
    ]);
    render(<HabitMonth habit={habit} checks={new Set()} today="2026-11-17" weekStart="mon" maxMonth="2026-11" />);
    expect(stan("2026-11-09")).toBe("pominiete"); // jeszcze codziennie
    expect(stan("2026-11-11")).toBe("szare"); // wersja tylko pn
    expect(stan("2026-11-16")).toBe("pominiete");
  });

  it("aria-label komórki: polska data i stan", () => {
    render(<HabitMonth habit={nawyk([codziennie("2026-11-01")])} checks={new Set(["2026-11-02"])} today="2026-11-17" weekStart="mon" maxMonth="2026-11" />);
    expect(screen.getByLabelText("2 listopada 2026 · zrobione")).toBeInTheDocument();
    expect(screen.getByLabelText("30 października 2026 · bez nawyku")).toBeInTheDocument();
  });
});
