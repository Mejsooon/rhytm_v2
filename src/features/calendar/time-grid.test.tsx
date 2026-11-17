import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TaskRow } from "@/features/tasks/model";
import type { CategoryRow } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { TimeGrid } from "./time-grid";

function wystapienie(nadpisz: Partial<Occurrence>): Occurrence {
  const blockId = nadpisz.blockId ?? "b1";
  const date = nadpisz.date ?? "2026-11-17";
  return {
    key: `${blockId}:${date}`,
    blockId,
    date,
    startMin: 480,
    durationMin: 60,
    title: "Blok",
    categoryId: "c1",
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
    ...nadpisz,
  };
}

function zadanie(id: string, blockId: string, occurrenceDate: string, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title: id,
    done,
    done_at: null,
    due_date: null,
    block_id: blockId,
    occurrence_date: occurrenceDate,
    position: 0,
    created_at: null,
  };
}

const kategorie: CategoryRow[] = [
  { id: "c1", name: "Studia", color: "#0070f3", hidden: false, is_system: false, position: 1, user_id: "u1", created_at: null },
];

const TYDZIEN = ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"];

function wyrenderuj(over: Partial<Parameters<typeof TimeGrid>[0]> = {}) {
  const onSlotClick = vi.fn();
  const onBlockClick = vi.fn();
  const wynik = render(
    <TimeGrid
      days={TYDZIEN}
      occurrences={[]}
      categories={kategorie}
      tasks={[]}
      clock="24"
      today="2026-11-17"
      nowMinutes={600}
      variant="week"
      onSlotClick={onSlotClick}
      onBlockClick={onBlockClick}
      {...over}
    />,
  );
  return { ...wynik, onSlotClick, onBlockClick };
}

describe("TimeGrid", () => {
  it("blok 08:00–09:30 ma top = 8 godzin i wysokość 1,5 h (48 px na godzinę w tygodniu)", () => {
    wyrenderuj({ occurrences: [wystapienie({ title: "Algebra", durationMin: 90 })] });
    const pole = screen.getByTestId("blok-b1:2026-11-17");
    expect(pole.style.top).toBe("384px");
    expect(pole.style.height).toBe("72px");
  });

  it("w widoku dnia godzina ma 52 px", () => {
    wyrenderuj({
      days: ["2026-11-17"],
      variant: "day",
      occurrences: [wystapienie({ title: "Algebra", durationMin: 90 })],
    });
    const pole = screen.getByTestId("blok-b1:2026-11-17");
    expect(pole.style.top).toBe("416px");
    expect(pole.style.height).toBe("78px");
  });

  it("trzy nakładające się bloki dzielą szerokość na 3", () => {
    wyrenderuj({
      occurrences: [
        wystapienie({ blockId: "a", title: "A" }),
        wystapienie({ blockId: "b", title: "B" }),
        wystapienie({ blockId: "c", title: "C" }),
      ],
    });
    for (const id of ["a", "b", "c"]) {
      expect(parseFloat(screen.getByTestId(`blok-${id}:2026-11-17`).style.width)).toBeCloseTo(100 / 3, 3);
    }
    expect(parseFloat(screen.getByTestId("blok-b:2026-11-17").style.left)).toBeCloseTo(100 / 3, 3);
  });

  it("blok 23:00–24:00 kończy się na dolnej krawędzi siatki", () => {
    wyrenderuj({ occurrences: [wystapienie({ startMin: 23 * 60, durationMin: 60 })] });
    const pole = screen.getByTestId("blok-b1:2026-11-17");
    const kolumna = screen.getByTestId("kolumna-2026-11-17");
    expect(parseInt(pole.style.top) + parseInt(pole.style.height)).toBe(24 * 48);
    expect(kolumna.style.height).toBe(`${24 * 48}px`);
  });

  it("linia „teraz” jest tylko w kolumnie dziś", () => {
    wyrenderuj();
    const linie = screen.getAllByTestId("linia-teraz");
    expect(linie).toHaveLength(1);
    expect(screen.getByTestId("kolumna-2026-11-17")).toContainElement(linie[0]);
    expect(linie[0].style.top).toBe(`${(600 / 60) * 48}px`);
  });

  it("w tygodniu bez dziś nie ma linii „teraz”", () => {
    wyrenderuj({ days: ["2026-11-23", "2026-11-24"] });
    expect(screen.queryByTestId("linia-teraz")).not.toBeInTheDocument();
  });

  it("clock 12 pokazuje etykiety „5 PM”", () => {
    wyrenderuj({ clock: "12" });
    expect(screen.getByText("5 PM")).toBeInTheDocument();
    expect(screen.getByText("12 AM")).toBeInTheDocument();
  });

  it("clock 24 pokazuje etykiety „17:00”", () => {
    wyrenderuj();
    expect(screen.getByText("17:00")).toBeInTheDocument();
  });

  it("pokazuje licznik 1/3 dla bloku z 3 zadaniami i ↻ przy cyklicznym", () => {
    wyrenderuj({
      occurrences: [
        wystapienie({
          title: "Seria",
          recurring: true,
          recurrence: { freq: "weekly" },
        }),
      ],
      tasks: [
        zadanie("t1", "b1", "2026-11-17", true),
        zadanie("t2", "b1", "2026-11-17", false),
        zadanie("t3", "b1", "2026-11-17", false),
        // zadanie innego wystąpienia nie liczy się
        zadanie("t4", "b1", "2026-11-10", true),
      ],
    });
    const pole = screen.getByTestId("blok-b1:2026-11-17");
    expect(pole).toHaveTextContent("08:00–09:00");
    expect(pole).toHaveTextContent("1/3");
    expect(pole).toHaveTextContent("↻");
  });

  it("licznik używa oryginalnej daty z klucza, gdy wystąpienie jest przesunięte", () => {
    wyrenderuj({
      occurrences: [
        wystapienie({ key: "b1:2026-11-10", date: "2026-11-17", title: "Przesunięty" }),
      ],
      tasks: [zadanie("t1", "b1", "2026-11-10", true)],
    });
    expect(screen.getByTestId("blok-b1:2026-11-10")).toHaveTextContent("1/1");
  });

  it("blok bez kategorii jest szary", () => {
    wyrenderuj({ occurrences: [wystapienie({ categoryId: null })] });
    expect(screen.getByRole("button", { name: /Blok/ }).style.borderLeft).toContain("163, 163, 163");
  });

  it("klik w blok woła onBlockClick z kluczem i elementem, a nie onSlotClick", async () => {
    const { onBlockClick, onSlotClick } = wyrenderuj({
      occurrences: [wystapienie({ title: "Algebra" })],
    });
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(onBlockClick).toHaveBeenCalledWith("b1:2026-11-17", expect.any(HTMLElement));
    expect(onSlotClick).not.toHaveBeenCalled();
  });

  it("klik w puste pole kolumny woła onSlotClick z dniem i pełną pół-godziną", () => {
    const { onSlotClick } = wyrenderuj();
    const kolumna = screen.getByTestId("kolumna-2026-11-18");
    // jsdom zwraca top = 0, więc clientY to wprost przesunięcie: 100 px / 24 px = 4. półgodzina = 02:00
    fireEvent.click(kolumna, { clientY: 100 });
    expect(onSlotClick).toHaveBeenCalledWith("2026-11-18", 120);
  });

  it("przewija siatkę na montażu do 06:00", () => {
    wyrenderuj();
    expect(screen.getByTestId("przewijanie").scrollTop).toBe(6 * 48);
  });

  it("przewija do trwającego bloku zamiast do 06:00", () => {
    wyrenderuj({
      nowMinutes: 14 * 60 + 30,
      occurrences: [wystapienie({ startMin: 14 * 60, durationMin: 120 })],
    });
    expect(screen.getByTestId("przewijanie").scrollTop).toBe(14 * 48);
  });

  it("w tygodniu ma nagłówki dni, dziś wyróżnione, i pusty wiersz „Cały dzień”", () => {
    wyrenderuj();
    expect(screen.getByTestId("naglowek-2026-11-17").className).toContain("text-[#15803d]");
    expect(screen.getByTestId("naglowek-2026-11-18").className).not.toContain("text-[#15803d]");
    expect(screen.getByText("Cały dzień")).toBeInTheDocument();
  });

  it("widok dnia: tytuł, „x z y bloków” i nazwa kategorii na bloku", () => {
    wyrenderuj({
      days: ["2026-11-17"],
      variant: "day",
      totalCount: 3,
      occurrences: [wystapienie({ title: "Algebra" })],
    });
    expect(screen.getByRole("heading", { name: "Wtorek, 17 listopada" })).toBeInTheDocument();
    expect(screen.getByText("1 z 3 bloków")).toBeInTheDocument();
    expect(screen.getByTestId("blok-b1:2026-11-17")).toHaveTextContent("Studia");
  });

  it("pusty dzień pokazuje ramkę z „Dodaj blok”, który otwiera nowy blok na ten dzień", async () => {
    const { onSlotClick } = wyrenderuj({ days: ["2026-11-17"], variant: "day" });
    expect(screen.getByText(/Brak bloków w tym dniu\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dodaj blok" }));
    expect(onSlotClick).toHaveBeenCalledWith("2026-11-17", 480);
  });
});
