import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TaskRow } from "@/features/tasks/model";
import type { Occurrence } from "./occurrences";
import { DaySide } from "./day-side";

function wystapienie(
  blockId: string,
  startMin: number,
  durationMin: number,
): Occurrence {
  return {
    key: `${blockId}:2026-11-17`,
    blockId,
    date: "2026-11-17",
    startMin,
    durationMin,
    title: blockId,
    categoryId: null,
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
  };
}

function zadanie(id: string, blockId: string | null, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title: id,
    done,
    done_at: null,
    due_date: null,
    block_id: blockId,
    occurrence_date: blockId ? "2026-11-17" : null,
    position: 0,
    created_at: null,
  };
}

function wyrenderuj(over: Partial<Parameters<typeof DaySide>[0]> = {}) {
  const onPick = vi.fn();
  render(
    <DaySide
      date="2026-11-18"
      today="2026-11-17"
      occurrences={[]}
      tasks={[]}
      onPick={onPick}
      {...over}
    />,
  );
  return { onPick };
}

describe("DaySide", () => {
  it("mini kalendarz: tytuł miesiąca, dziś z obwódką, wybrany czarny", () => {
    wyrenderuj();
    // Tekst bez zmian, wielką literę daje CSS (jak „Listopad 2026” w makiecie)
    expect(screen.getByText("listopad 2026").className).toContain(
      "first-letter:uppercase",
    );
    // Dziś jak w DatePicker: obwódka border-strong
    expect(
      screen.getByRole("button", { name: "17 listopada" }).className,
    ).toContain("border-border-strong");
    const wybrany = screen.getByRole("button", { name: "18 listopada" });
    expect(wybrany.className).toContain("bg-primary");
    expect(wybrany.className).toContain("text-primary-foreground");
    expect(wybrany.className).toContain("h-[30px]");
  });

  it("wygląd COSS: szary panel 288 px z kartami, strzałki ghost", () => {
    wyrenderuj();
    const panel = screen.getByRole("complementary");
    // Makieta: 288 px treści + 2 × 16 px paddingu + 1 px ramki (content-box)
    expect(panel.className).toContain("w-[321px]");
    expect(panel.className).toContain("bg-panel");
    expect(panel.querySelectorAll(".shadow-card")).toHaveLength(2);
    const strzalka = screen.getByRole("button", { name: "Następny miesiąc" });
    expect(strzalka.className).toContain("bg-transparent");
    expect(strzalka.querySelector("svg")).not.toBeNull();
    expect(
      screen.getByRole("heading", { level: 2, name: "Dzień w liczbach" }),
    ).toBeInTheDocument();
  });

  it("klik dnia woła onPick z datą", async () => {
    const { onPick } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "20 listopada" }));
    expect(onPick).toHaveBeenCalledWith("2026-11-20");
  });

  it("strzałki zmieniają miesiąc", async () => {
    wyrenderuj();
    await userEvent.click(
      screen.getByRole("button", { name: "Następny miesiąc" }),
    );
    expect(screen.getByText("grudzień 2026")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Poprzedni miesiąc" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Poprzedni miesiąc" }),
    );
    expect(screen.getByText("październik 2026")).toBeInTheDocument();
  });

  it("„Dzień w liczbach”: zaplanowane, wolne (8–20) i zadania z dayNumbers", () => {
    wyrenderuj({
      date: "2026-11-17",
      occurrences: [
        wystapienie("a", 8 * 60, 150),
        wystapienie("b", 18 * 60 + 30, 90),
      ],
      tasks: [
        zadanie("t1", "a", true),
        zadanie("t2", "a", false),
        zadanie("t3", "b", false),
        zadanie("t4", null, true),
      ],
    });
    expect(screen.getByText("Dzień w liczbach")).toBeInTheDocument();
    // 2 h 30 min + 1 h 30 min = 4 h
    expect(screen.getByText("4 h")).toBeInTheDocument();
    // okno 12 h minus zajęte (2 h 30 min + 1 h 30 min) = 8 h
    expect(screen.getByText("8 h")).toBeInTheDocument();
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    // Pasek postępu zadań pod liczbami (.prog z makiety)
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "1",
    );
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuemax",
      "3",
    );
  });

  it("format godzin z połówką: 2 h 30 min", () => {
    wyrenderuj({
      date: "2026-11-17",
      occurrences: [wystapienie("a", 8 * 60, 150)],
    });
    expect(screen.getByText("2 h 30 min")).toBeInTheDocument();
    expect(screen.getByText("9 h 30 min")).toBeInTheDocument();
  });
});
