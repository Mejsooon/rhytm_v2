import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addTask, toggleTask } = vi.hoisted(() => ({
  addTask: vi.fn(),
  toggleTask: vi.fn(),
}));
vi.mock("@/features/tasks/actions", () => ({ addTask, toggleTask }));

import type { TaskRow } from "@/features/tasks/model";
import { kategoria, wystapienie } from "./fixtures";
import { MBlockDetail } from "./m-block-detail";

function zadanie(id: string, title: string, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title,
    done,
    done_at: null,
    due_date: "2026-11-15",
    block_id: "b1",
    occurrence_date: "2026-11-15",
    position: 1,
    created_at: null,
  };
}

const ZADANIA = [
  zadanie("z1", "Rozgrzewka 10 min", true),
  zadanie("z2", "Tempo 5:10/km", false),
];

function wyrenderuj(
  nadpisz: Partial<React.ComponentProps<typeof MBlockDetail>> = {},
) {
  const applyOptimistic = vi.fn().mockResolvedValue(true);
  const props = {
    occurrence: {
      ...wystapienia(),
    },
    tasks: ZADANIA,
    category: kategoria("c1", "Sport", "#f59e0b"),
    clock: "24" as const,
    applyOptimistic,
    onEdit: vi.fn(),
    onDelete: vi.fn(),
    onClose: vi.fn(),
    ...nadpisz,
  };
  render(<MBlockDetail {...props} />);
  return { ...props, applyOptimistic };
}

function wystapienia() {
  return {
    ...wystapienie(
      "b1:2026-11-15",
      "2026-11-15",
      16 * 60,
      60,
      "Bieg 10 km",
      "c1",
    ),
    note: "Trasa nad Zalewem.",
  };
}

beforeEach(() => vi.clearAllMocks());

describe("MBlockDetail", () => {
  it("jedno ✕, plakietka kategorii, tytuł, dzień · godziny · czas i notatka", () => {
    wyrenderuj();
    const arkusz = screen.getByRole("dialog", { name: "Szczegóły bloku" });
    expect(
      within(arkusz).getAllByRole("button", { name: "Zamknij" }),
    ).toHaveLength(1);
    expect(arkusz).toHaveTextContent("Sport");
    expect(
      within(arkusz).getByRole("heading", { name: "Bieg 10 km" }),
    ).toBeInTheDocument();
    expect(arkusz).toHaveTextContent("nd 15.11 · 16:00–17:00 · 1 h");
    expect(arkusz).toHaveTextContent("Trasa nad Zalewem.");
  });

  it("reguła powtarzania pod czasem, bez dopisku o pustych listach zadań", () => {
    wyrenderuj({
      occurrence: {
        ...wystapienia(),
        recurring: true,
        recurrence: { freq: "weekly", until: "2027-01-31" },
      },
    });
    expect(
      screen.getByText("Co tydzień w niedziele, do 31.01.2027"),
    ).toBeInTheDocument();
  });

  it("karta zadań: „Zadania · 1 z 2”, odhaczone przekreślone, przełączenie woła toggleTask", async () => {
    const { applyOptimistic } = wyrenderuj();
    expect(screen.getByText("Zadania · 1 z 2")).toBeInTheDocument();
    expect(screen.getByText("Rozgrzewka 10 min")).toHaveClass("line-through");
    expect(screen.getByText("Tempo 5:10/km")).not.toHaveClass("line-through");
    expect(
      screen.getByRole("checkbox", { name: "Rozgrzewka 10 min" }),
    ).toHaveAttribute("aria-checked", "true");

    // Klik w tekst wiersza przełącza pole (cały wiersz jest celem dotyku)
    await userEvent.click(screen.getByText("Tempo 5:10/km"));
    expect(applyOptimistic).toHaveBeenCalledTimes(1);
    await applyOptimistic.mock.calls[0][1]();
    expect(toggleTask).toHaveBeenCalledWith({ id: "z2", done: true });
  });

  it("Enter w polu „Dodaj zadanie…” dodaje zadanie wystąpienia", async () => {
    const { applyOptimistic } = wyrenderuj();
    const pole = screen.getByRole("textbox", { name: "Nowe zadanie" });
    await userEvent.type(pole, "Kawa{Enter}");
    expect(pole).toHaveValue("");
    await applyOptimistic.mock.calls[0][1]();
    expect(addTask).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-15",
      title: "Kawa",
    });
  });

  it("stopka: „Usuń” i „Edytuj” wołają swoje akcje", async () => {
    const { onDelete, onEdit } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("blok bez kategorii i bez zadań", () => {
    wyrenderuj({ category: undefined, tasks: [] });
    expect(screen.getByText("Bez kategorii")).toBeInTheDocument();
    expect(screen.getByText("Zadania · 0 z 0")).toBeInTheDocument();
  });
});
