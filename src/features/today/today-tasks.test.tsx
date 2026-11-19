import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toggleTask, createStandaloneTask, refresh, toastError } = vi.hoisted(
  () => ({
    toggleTask: vi.fn(),
    createStandaloneTask: vi.fn(),
    refresh: vi.fn(),
    toastError: vi.fn(),
  }),
);
vi.mock("@/features/tasks/actions", () => ({
  toggleTask,
  createStandaloneTask,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { TaskRow } from "@/features/tasks/model";
import type { TodayData } from "./load-today";
import { TodayTasks } from "./today-tasks";
import { useTodayStore } from "./use-today-store";

function zadanie(
  id: string,
  title: string,
  due: string | null,
  done = false,
  nadpisz: Partial<TaskRow> = {},
): TaskRow {
  return {
    id,
    user_id: "u1",
    title,
    done,
    done_at: null,
    due_date: due,
    block_id: null,
    occurrence_date: null,
    position: 0,
    created_at: null,
    ...nadpisz,
  };
}

function dane(tasks: TaskRow[]): TodayData {
  return {
    profile: {
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      displayName: null,
      avatarPath: null,
      sleepGoalMin: 480,
      kmGoalOn: false,
      weeklyKmGoal: 25,
      workoutsGoalOn: false,
      weeklyWorkoutsGoal: 3,
      createdAt: "2026-11-01T10:00:00Z",
    },
    today: "2026-11-17",
    nowMin: 600,
    weekStartDate: "2026-11-16",
    blocks: [],
    occurrencesToday: [],
    categories: [],
    tasks,
    habits: [],
    checks: new Map(),
    sleepLogs: [],
    sportItems: [],
    counts: { blocks: 1, habits: 1, workouts: 1, sleepLogs: 1 },
  };
}

const zadania = [
  zadanie("t1", "Mail do promotora", "2026-11-17"),
  zadanie("t2", "Oddać książkę", "2026-11-12"),
  zadanie("t3", "Zrobione dziś", "2026-11-17", true),
  zadanie("t4", "Kupić buty", null),
  zadanie("t5", "Jutrzejsze", "2026-11-18"),
  // Zadanie bloku — należy do dymku bloku, nie do tej listy
  zadanie("t6", "Z bloku", "2026-11-17", false, {
    block_id: "b1",
    occurrence_date: "2026-11-17",
  }),
];

function Lista({ d }: { d: TodayData }) {
  const { data, applyOptimistic } = useTodayStore(d);
  return (
    <TodayTasks
      tasks={data.tasks}
      today={data.today}
      applyOptimistic={applyOptimistic}
    />
  );
}

function wiersze(sekcja: HTMLElement) {
  return within(sekcja)
    .getAllByRole("checkbox")
    .map((c) => c.closest("label")?.textContent);
}

beforeEach(() => vi.clearAllMocks());

describe("TodayTasks", () => {
  it("dzisiejsze i zaległe samodzielne zadania, zaległe na górze z „zaległe” i datą", () => {
    render(<Lista d={dane(zadania)} />);
    const sekcja = screen.getByRole("region", { name: "Zadania na dziś" });
    expect(wiersze(sekcja)).toEqual([
      "Oddać książkęzaległe12.11",
      "Mail do promotora",
      "Zrobione dziś",
    ]);
    expect(within(sekcja).getByText("1 z 3")).toBeInTheDocument();
  });

  it("odhaczenie jest optymistyczne; zrobione zaległe znika z listy", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    toggleTask.mockImplementation(() => new Promise((r) => (zakoncz = r)));
    render(<Lista d={dane(zadania)} />);
    await userEvent.click(screen.getByLabelText("Mail do promotora"));
    expect(toggleTask).toHaveBeenCalledWith({ id: "t1", done: true });
    expect(screen.getByLabelText("Mail do promotora")).toBeChecked();
    await userEvent.click(screen.getByLabelText(/Oddać książkę/));
    expect(screen.queryByLabelText(/Oddać książkę/)).not.toBeInTheDocument();
    zakoncz({ ok: true });
  });

  it("błąd odhaczenia cofa zmianę i pokazuje toast", async () => {
    toggleTask.mockResolvedValue({ ok: false, message: "x" });
    render(<Lista d={dane(zadania)} />);
    await userEvent.click(screen.getByLabelText("Mail do promotora"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(screen.getByLabelText("Mail do promotora")).not.toBeChecked();
  });

  it("„+ Zadanie”: Enter dodaje zadanie na dziś od razu i odświeża dane", async () => {
    createStandaloneTask.mockResolvedValue({ ok: true, id: "n1" });
    render(<Lista d={dane(zadania)} />);
    const sekcja = screen.getByRole("region", { name: "Zadania na dziś" });
    await userEvent.click(
      within(sekcja).getByRole("button", { name: "+ Zadanie" }),
    );
    const pole = within(sekcja).getByRole("textbox", { name: "Nowe zadanie" });
    expect(pole).toHaveFocus();
    await userEvent.type(pole, "Zadzwonić{Enter}");
    expect(createStandaloneTask).toHaveBeenCalledWith({
      title: "Zadzwonić",
      dueDate: "2026-11-17",
    });
    expect(within(sekcja).getByText("Zadzwonić")).toBeInTheDocument();
    expect(pole).toHaveValue("");
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("„+ Zadanie”: Esc anuluje bez zapisu", async () => {
    render(<Lista d={dane(zadania)} />);
    const sekcja = screen.getByRole("region", { name: "Zadania na dziś" });
    await userEvent.click(
      within(sekcja).getByRole("button", { name: "+ Zadanie" }),
    );
    await userEvent.type(
      within(sekcja).getByRole("textbox", { name: "Nowe zadanie" }),
      "Coś{Escape}",
    );
    expect(
      within(sekcja).queryByRole("textbox", { name: "Nowe zadanie" }),
    ).not.toBeInTheDocument();
    expect(createStandaloneTask).not.toHaveBeenCalled();
    expect(within(sekcja).queryByText("Coś")).not.toBeInTheDocument();
  });

  it("„Bez daty” jest zwinięte z licznikiem, rozwija się i ma własne „+ Zadanie”", async () => {
    createStandaloneTask.mockResolvedValue({ ok: true, id: "n2" });
    render(<Lista d={dane(zadania)} />);
    const przycisk = screen.getByRole("button", { name: /Bez daty/ });
    expect(przycisk).toHaveAttribute("aria-expanded", "false");
    expect(przycisk).toHaveTextContent("1");
    expect(screen.queryByLabelText("Kupić buty")).not.toBeInTheDocument();

    await userEvent.click(przycisk);
    expect(przycisk).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByLabelText("Kupić buty")).toBeInTheDocument();

    const bezDaty = screen.getByRole("group", { name: "Bez daty" });
    await userEvent.click(
      within(bezDaty).getByRole("button", { name: "+ Zadanie" }),
    );
    await userEvent.type(
      within(bezDaty).getByRole("textbox", { name: "Nowe zadanie" }),
      "Kiedyś{Enter}",
    );
    expect(createStandaloneTask).toHaveBeenCalledWith({
      title: "Kiedyś",
      dueDate: null,
    });
    expect(przycisk).toHaveTextContent("2");
  });

  it("bez zadań na dziś pokazuje komunikat", () => {
    render(<Lista d={dane([])} />);
    expect(screen.getByText("Brak zadań na dziś.")).toBeInTheDocument();
  });
});
