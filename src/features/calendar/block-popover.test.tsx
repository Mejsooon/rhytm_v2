import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { addTask, toggleTask, deleteTask, unpinTask, toastError } = vi.hoisted(
  () => ({
    addTask: vi.fn(),
    toggleTask: vi.fn(),
    deleteTask: vi.fn(),
    unpinTask: vi.fn(),
    toastError: vi.fn(),
  }),
);
vi.mock("@/features/tasks/actions", () => ({
  addTask,
  toggleTask,
  deleteTask,
  unpinTask,
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { TaskRow } from "@/features/tasks/model";
import { BlockPopover } from "./block-popover";
import type { CalendarData } from "./load-calendar";
import type { Occurrence } from "./occurrences";
import { useCalendarStore } from "./use-calendar-store";

function zadanie(id: string, title: string, done: boolean): TaskRow {
  return {
    id,
    user_id: "u1",
    title,
    done,
    done_at: null,
    due_date: "2026-11-17",
    block_id: "b1",
    occurrence_date: "2026-11-17",
    position: 0,
    created_at: null,
  };
}

function wystapienie(nadpisz: Partial<Occurrence> = {}): Occurrence {
  return {
    key: "b1:2026-11-17",
    blockId: "b1",
    date: "2026-11-17",
    startMin: 600,
    durationMin: 150,
    title: "rhytm — kod",
    categoryId: "c1",
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
    ...nadpisz,
  };
}

const dane: CalendarData = {
  blocks: [],
  exceptions: [],
  tasks: [
    zadanie("t1", "Migracja", true),
    zadanie("t2", "Szablony", false),
    zadanie("t3", "Testy RLS", false),
  ],
  categories: [
    {
      id: "c1",
      name: "Projekty",
      color: "#15803d",
      hidden: false,
      is_system: false,
      position: 1,
      user_id: "u1",
      created_at: null,
    },
  ],
  profile: { timezone: "Europe/Warsaw", weekStart: "mon", clock: "24" },
  sport: [],
};

function Wrapper({
  occurrence = wystapienie(),
  onEdit = () => {},
  onDelete = () => {},
  onClose = () => {},
}: {
  occurrence?: Occurrence;
  onEdit?: () => void;
  onDelete?: () => void;
  onClose?: () => void;
}) {
  const { data, applyOptimistic } = useCalendarStore(dane);
  return (
    <BlockPopover
      occurrence={occurrence}
      tasks={data.tasks}
      category={data.categories[0]}
      clock={data.profile.clock}
      applyOptimistic={applyOptimistic}
      onEdit={onEdit}
      onDelete={onDelete}
      onClose={onClose}
    />
  );
}

function wyrenderuj(props: React.ComponentProps<typeof Wrapper> = {}) {
  const kotwica = document.createElement("button");
  kotwica.dataset.occurrenceKey = "b1:2026-11-17";
  document.body.appendChild(kotwica);
  return render(<Wrapper {...props} />);
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = "";
  addTask.mockResolvedValue({ ok: true });
  toggleTask.mockResolvedValue({ ok: true });
  deleteTask.mockResolvedValue({ ok: true });
  unpinTask.mockResolvedValue({ ok: true });
});

describe("BlockPopover", () => {
  it("pokazuje kategorię, tytuł, godziny i postęp zadań", () => {
    wyrenderuj();
    expect(screen.getByText("Projekty")).toBeInTheDocument();
    expect(screen.getByText("rhytm — kod")).toBeInTheDocument();
    expect(screen.getByText(/10:00–12:30/)).toBeInTheDocument();
    expect(screen.getByText("1 z 3")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute(
      "aria-valuenow",
      "33",
    );
  });

  it("odhaczenie od razu zmienia licznik i woła toggleTask", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("checkbox", { name: "Szablony" }));
    expect(screen.getByText("2 z 3")).toBeInTheDocument();
    expect(toggleTask).toHaveBeenCalledWith({ id: "t2", done: true });
  });

  it("błąd zapisu cofa odhaczenie i pokazuje toast", async () => {
    toggleTask.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    await userEvent.click(screen.getByRole("checkbox", { name: "Szablony" }));
    await waitFor(() => expect(screen.getByText("1 z 3")).toBeInTheDocument());
    expect(toastError).toHaveBeenCalled();
  });

  it("Enter w polu dodaje zadanie z oryginalną datą wystąpienia", async () => {
    // Blok przesunięty: wyświetlany 18.11, oryginalna data 17.11 siedzi w kluczu
    wyrenderuj({ occurrence: wystapienie({ date: "2026-11-18" }) });
    const pole = screen.getByRole("textbox", { name: "Nowe zadanie" });
    await userEvent.type(pole, "Kupić mleko{Enter}");
    expect(screen.getByText("Kupić mleko")).toBeInTheDocument();
    expect(screen.getByText("1 z 4")).toBeInTheDocument();
    expect(addTask).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-17",
      title: "Kupić mleko",
    });
    expect(pole).toHaveValue("");
  });

  it("pusty tekst nie wywołuje akcji", async () => {
    wyrenderuj();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Nowe zadanie" }),
      "   {Enter}",
    );
    expect(addTask).not.toHaveBeenCalled();
  });

  it("błąd dodania cofa zadanie i pokazuje toast", async () => {
    addTask.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    await userEvent.type(
      screen.getByRole("textbox", { name: "Nowe zadanie" }),
      "Kupić mleko{Enter}",
    );
    await waitFor(() =>
      expect(screen.queryByText("Kupić mleko")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("1 z 3")).toBeInTheDocument();
    expect(toastError).toHaveBeenCalled();
  });

  it("błąd usunięcia przywraca zadanie i pokazuje toast", async () => {
    deleteTask.mockResolvedValue({ ok: false, message: "x" });
    wyrenderuj();
    await userEvent.click(
      screen.getByRole("button", { name: "Usuń zadanie Szablony" }),
    );
    await waitFor(() =>
      expect(screen.getByText("Szablony")).toBeInTheDocument(),
    );
    expect(toastError).toHaveBeenCalled();
  });

  it("zamyka się, gdy bloku-kotwicy nie ma w DOM", () => {
    const onClose = vi.fn();
    wyrenderuj({ onClose, occurrence: wystapienie({ key: "b1:2026-11-18" }) });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalled();
  });

  it("× usuwa zadanie, a Odepnij je odpina", async () => {
    wyrenderuj();
    await userEvent.click(
      screen.getByRole("button", { name: "Usuń zadanie Szablony" }),
    );
    expect(screen.queryByText("Szablony")).not.toBeInTheDocument();
    expect(deleteTask).toHaveBeenCalledWith({ id: "t2" });

    await userEvent.click(
      screen.getByRole("button", { name: "Opcje zadania Testy RLS" }),
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Odepnij zadanie Testy RLS" }),
    );
    expect(screen.queryByText("Testy RLS")).not.toBeInTheDocument();
    expect(unpinTask).toHaveBeenCalledWith({ taskId: "t3" });
  });

  it("blok cykliczny pokazuje znaczek, a Usuń i Edytuj wołają callbacki", async () => {
    const onDelete = vi.fn();
    const onEdit = vi.fn();
    wyrenderuj({
      occurrence: wystapienie({
        recurring: true,
        recurrence: { freq: "weekly" },
      }),
      onDelete,
      onEdit,
    });
    expect(screen.getByText("↻ co tydzień")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onDelete).toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(onEdit).toHaveBeenCalled();
  });

  it("notatka pokazuje się, gdy blok ją ma", () => {
    wyrenderuj({ occurrence: wystapienie({ note: "Najpierw migracje" }) });
    expect(screen.getByText("Najpierw migracje")).toBeInTheDocument();
  });

  it("Esc zamyka dymek", async () => {
    const onClose = vi.fn();
    wyrenderuj({ onClose });
    await act(async () => {
      await userEvent.keyboard("{Escape}");
    });
    expect(onClose).toHaveBeenCalled();
  });
});
