import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TaskRow } from "@/features/tasks/model";
import { DaySide } from "./day-side";
import type { Occurrence } from "./occurrences";

function wystapienie(blockId: string, startMin: number, durationMin: number): Occurrence {
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

function zadanie(id: string, blockId: string, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title: id,
    done,
    done_at: null,
    due_date: null,
    block_id: blockId,
    occurrence_date: "2026-11-17",
    position: 0,
    created_at: null,
  };
}

describe("DaySide („Plan dnia”)", () => {
  it("liczy bloki, godziny i zadania, a listę układa po godzinie", () => {
    render(
      <DaySide
        occurrences={[wystapienie("Później", 840, 60), wystapienie("Rano", 480, 90)]}
        tasks={[zadanie("z1", "Rano", true), zadanie("z2", "Rano", false)]}
        categories={[]}
        clock="24"
        onBlockClick={vi.fn()}
      />,
    );
    expect(screen.getByTestId("liczba-Bloki")).toHaveTextContent("2");
    expect(screen.getByTestId("liczba-Godziny")).toHaveTextContent("2,5");
    expect(screen.getByTestId("liczba-Zadania")).toHaveTextContent("1/2");
    const pozycje = screen.getAllByRole("button");
    expect(pozycje[0]).toHaveTextContent("08:00Rano1/2");
    expect(pozycje[1]).toHaveTextContent("14:00Później");
  });

  it("klik w pozycję otwiera blok", async () => {
    const onBlockClick = vi.fn();
    render(
      <DaySide occurrences={[wystapienie("Rano", 480, 60)]} tasks={[]} categories={[]} clock="24" onBlockClick={onBlockClick} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Rano/ }));
    expect(onBlockClick).toHaveBeenCalledWith("Rano:2026-11-17", expect.any(HTMLElement));
  });

  it("pusty dzień ma podpowiedź", () => {
    render(<DaySide occurrences={[]} tasks={[]} categories={[]} clock="24" onBlockClick={vi.fn()} />);
    expect(screen.getByText("Brak bloków. Kliknij w siatkę, żeby dodać pierwszy.")).toBeInTheDocument();
  });
});
