import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { HabitHeatmap } from "./habit-heatmap";
import type { Checks, Habit } from "./model";

const DZIS = "2026-11-17";

function codzienny(id: string): Habit {
  return {
    id,
    name: id,
    remindAt: null,
    showOnToday: true,
    createdAt: "",
    schedules: [
      {
        validFrom: "2026-11-10",
        type: "daily",
        weekdays: [],
        timesPerWeek: null,
      },
    ],
  };
}

const NAWYKI = [codzienny("a"), codzienny("b"), codzienny("c")];
const CHECKS: Checks = new Map([
  ["a", new Set([DZIS])],
  ["b", new Set([DZIS])],
]);

function wyrenderuj() {
  render(
    <HabitHeatmap
      habits={NAWYKI}
      checks={CHECKS}
      today={DZIS}
      weekStart="mon"
    />,
  );
}

describe("HabitHeatmap", () => {
  it("domyślnie rok: 52 kolumny tygodni", () => {
    wyrenderuj();
    expect(screen.getByRole("radio", { name: "Rok" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(document.querySelectorAll("[data-heat-cell]")).toHaveLength(52 * 7);
  });

  it("3 i 6 mies. pokazują 13 i 26 kolumn", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "3 mies." }));
    expect(document.querySelectorAll("[data-heat-cell]")).toHaveLength(13 * 7);
    await userEvent.click(screen.getByRole("radio", { name: "6 mies." }));
    expect(document.querySelectorAll("[data-heat-cell]")).toHaveLength(26 * 7);
  });

  it("miesiąc: › wyłączony w bieżącym, ‹ wyłączony po 12 krokach", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    expect(screen.getByText("listopad 2026")).toBeInTheDocument();
    const wstecz = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    const dalej = screen.getByRole("button", { name: "Następny miesiąc" });
    expect(dalej).toBeDisabled();
    for (let i = 0; i < 12; i++) await userEvent.click(wstecz);
    expect(screen.getByText("listopad 2025")).toBeInTheDocument();
    expect(wstecz).toBeDisabled();
    expect(dalej).toBeEnabled();
  });

  it("dymek dnia: „x z y nawyków”, dzień bez planu jest szary", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    const dzis = screen.getByLabelText("17.11.2026 · 2 z 3 nawyków");
    fireEvent.mouseEnter(dzis);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "17.11.2026 · 2 z 3 nawyków",
    );
    // Dymek w portalu na <body> — karta z overflow go nie przytnie
    expect(screen.getByRole("tooltip").parentElement).toBe(document.body);

    const bezPlanu = screen.getByLabelText("01.11.2026 · brak zaplanowanych");
    expect(bezPlanu.className).toContain("bg-[#fafafa]");
    fireEvent.mouseEnter(bezPlanu);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "01.11.2026 · brak zaplanowanych",
    );
  });

  it("dzień bez planu wygląda inaczej niż dzień z planem i 0%", async () => {
    // a, b, c codziennie od 10.11; 16.11: nic nie odhaczone (0%), 09.11: przed startem (bez planu)
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    const bezPlanu = screen.getByLabelText("09.11.2026 · brak zaplanowanych");
    const zero = screen.getByLabelText("16.11.2026 · 0 z 3 nawyków");
    expect(bezPlanu.className).toContain("bg-[#fafafa]");
    expect(bezPlanu.className).toContain("border-dashed");
    expect(bezPlanu.className).toContain("border-[#d4d4d4]");
    expect(zero.className).toContain("bg-[#f0f0f0]");
    expect(zero.className).not.toContain("border-dashed");
    expect(bezPlanu.className).not.toBe(zero.className);
  });

  it("komórka dostaje fokus z klawiatury i wtedy pokazuje dymek", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "3 mies." }));
    const dzis = screen.getByLabelText("17.11.2026 · 2 z 3 nawyków");
    expect(dzis).toHaveAttribute("tabindex", "0");
    act(() => dzis.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "17.11.2026 · 2 z 3 nawyków",
    );
    act(() => dzis.blur());
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
