import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildMonthGrid } from "@/components/controls/calendar-math";
import type { CategoryRow } from "./load-calendar";
import { MonthGrid } from "./month-grid";
import type { Occurrence } from "./occurrences";

const dni = buildMonthGrid(2026, 10, "mon").map((c) => c.date);

const kategorie: CategoryRow[] = [
  { id: "c1", name: "Studia", color: "#0070f3", hidden: false, is_system: false, position: 1, user_id: "u1", created_at: null },
];

function wystapienie(id: string, date: string, startMin: number, nadpisz: Partial<Occurrence> = {}): Occurrence {
  return {
    key: `${id}:${date}`,
    blockId: id,
    date,
    startMin,
    durationMin: 60,
    title: `Wpis ${id}`,
    categoryId: "c1",
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
    ...nadpisz,
  };
}

function wyrenderuj(occurrences: Occurrence[], nadpisz: Partial<Parameters<typeof MonthGrid>[0]> = {}) {
  const onDayClick = vi.fn();
  const onEntryClick = vi.fn();
  render(
    <MonthGrid
      days={dni}
      month0={10}
      occurrences={occurrences}
      categories={kategorie}
      today="2026-11-17"
      clock="24"
      onDayClick={onDayClick}
      onEntryClick={onEntryClick}
      {...nadpisz}
    />,
  );
  return { onDayClick, onEntryClick };
}

describe("MonthGrid", () => {
  it("pokazuje nagłówki dni od poniedziałku i 42 komórki", () => {
    wyrenderuj([]);
    const naglowki = screen.getAllByTestId("nazwa-dnia").map((e) => e.textContent);
    expect(naglowki).toEqual(["pon", "wt", "śr", "czw", "pt", "sob", "nd"]);
    expect(screen.getAllByTestId(/^komorka-/)).toHaveLength(42);
  });

  it("komórka z 5 wpisami pokazuje 3 i „+2 więcej”", () => {
    const wpisy = [1, 2, 3, 4, 5].map((i) => wystapienie(`b${i}`, "2026-11-18", 480 + i * 60));
    wyrenderuj(wpisy);
    const komorka = screen.getByTestId("komorka-2026-11-18");
    expect(within(komorka).getAllByRole("button", { name: /Wpis/ })).toHaveLength(3);
    expect(within(komorka).getByRole("link", { name: "+2 więcej" })).toBeInTheDocument();
  });

  it("„+2 więcej” prowadzi do widoku dnia", () => {
    const wpisy = [1, 2, 3, 4, 5].map((i) => wystapienie(`b${i}`, "2026-11-18", 480 + i * 60));
    wyrenderuj(wpisy);
    expect(screen.getByRole("link", { name: "+2 więcej" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=dzien&data=2026-11-18",
    );
  });

  it("wpis ma godzinę wg zegara profilu, tytuł i klucz wystąpienia", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 13 * 60 + 30)], { clock: "12" });
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    expect(wpis).toHaveTextContent("1:30 PM");
    expect(wpis).toHaveAttribute("data-occurrence-key", "b1:2026-11-18");
  });

  it("wpis bez kategorii ma szarą kropkę", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 480, { categoryId: null })]);
    expect(screen.getByTestId("kropka-b1:2026-11-18")).toHaveStyle({ backgroundColor: "#a3a3a3" });
  });

  it("klik we wpis woła onEntryClick z kluczem i elementem, nie otwiera „Nowy wpis”", async () => {
    const { onEntryClick, onDayClick } = wyrenderuj([wystapienie("b1", "2026-11-18", 480)]);
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    await userEvent.click(wpis);
    expect(onEntryClick).toHaveBeenCalledWith("b1:2026-11-18", wpis);
    expect(onDayClick).not.toHaveBeenCalled();
  });

  it("klik w pustą część komórki woła onDayClick z datą i komórką", () => {
    const { onDayClick } = wyrenderuj([]);
    const komorka = screen.getByTestId("komorka-2026-11-19");
    fireEvent.click(komorka);
    expect(onDayClick).toHaveBeenCalledWith("2026-11-19", komorka);
  });

  it("przycisk „+” komórki działa z klawiatury i woła onDayClick", async () => {
    const { onDayClick } = wyrenderuj([]);
    await userEvent.click(screen.getByRole("button", { name: "Nowy wpis 19.11" }));
    expect(onDayClick).toHaveBeenCalledTimes(1);
    expect(onDayClick.mock.calls[0][0]).toBe("2026-11-19");
  });

  it("wyróżnia dziś i szarzy dni spoza miesiąca", () => {
    wyrenderuj([]);
    expect(screen.getByTestId("numer-2026-11-17").className).toContain("bg-[#15803d]");
    expect(screen.getByTestId("numer-2026-10-26").className).toContain("text-[#a3a3a3]");
    expect(screen.getByTestId("numer-2026-11-10").className).not.toContain("text-[#a3a3a3]");
  });
});
