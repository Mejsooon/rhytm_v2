import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CalendarPanel } from "./calendar-panel";

function wyrenderuj(over: Partial<Parameters<typeof CalendarPanel>[0]> = {}) {
  const props = {
    view: "tydzien" as const,
    date: "2026-11-17",
    today: "2026-11-17",
    weekStart: "mon" as const,
    weekNumbers: true,
    categories: [
      { id: "c1", name: "Studia", color: "#0070f3", hidden: false, is_system: false, position: 0, user_id: "u1", created_at: null },
    ],
    onToggleCategory: vi.fn(),
    onAddCategory: vi.fn(),
    showSport: true,
    showRenewals: false,
    onToggleSport: vi.fn(),
    onToggleRenewals: vi.fn(),
    plannedMin: 1470,
    onPick: vi.fn(),
    ...over,
  };
  render(<CalendarPanel {...props} />);
  return props;
}

describe("CalendarPanel", () => {
  it("przełącza kategorię i warstwy", () => {
    const p = wyrenderuj();
    fireEvent.click(screen.getByRole("button", { name: "Studia" }));
    expect(p.onToggleCategory).toHaveBeenCalledWith(p.categories[0]);
    const odnowienia = screen.getByRole("button", { name: /Odnowienia/ });
    expect(odnowienia).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(odnowienia);
    expect(p.onToggleRenewals).toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Treningi/ }));
    expect(p.onToggleSport).toHaveBeenCalled();
  });

  it("mini kalendarz: numer tygodnia, strzałki i wybór dnia", () => {
    const p = wyrenderuj();
    const mini = screen.getByRole("region", { name: "Listopad 2026" });
    expect(within(mini).getByText("47")).toBeInTheDocument();
    fireEvent.click(within(mini).getByRole("button", { name: "20 listopada" }));
    expect(p.onPick).toHaveBeenCalledWith("2026-11-20");
    fireEvent.click(within(mini).getByRole("button", { name: "Następny miesiąc" }));
    expect(screen.getByRole("region", { name: "Grudzień 2026" })).toBeInTheDocument();
  });

  it("pokazuje sumę godzin okresu", () => {
    wyrenderuj();
    expect(screen.getByText("24,5 h")).toBeInTheDocument();
  });
});
