import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBlock, changeOccurrence, toggleTask, refresh, toastError } =
  vi.hoisted(() => ({
    createBlock: vi.fn(),
    changeOccurrence: vi.fn(),
    toggleTask: vi.fn(),
    refresh: vi.fn(),
    toastError: vi.fn(),
  }));
vi.mock("@/features/calendar/actions", () => ({
  createBlock,
  changeOccurrence,
}));
vi.mock("@/features/categories/actions", () => ({ createCategory: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({
  toggleTask,
  addTask: vi.fn(),
  deleteTask: vi.fn(),
  unpinTask: vi.fn(),
  createStandaloneTask: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import type { Occurrence } from "@/features/calendar/occurrences";
import type { SportItem } from "@/features/sport/model";
import type { TaskRow } from "@/features/tasks/model";
import { DayPlan } from "./day-plan";
import type { TodayData } from "./load-today";
import { useTodayStore } from "./use-today-store";

function wystapienie(
  blockId: string,
  startMin: number,
  durationMin: number,
  title: string,
): Occurrence {
  return {
    key: `${blockId}:2026-11-17`,
    blockId,
    date: "2026-11-17",
    startMin,
    durationMin,
    title,
    categoryId: "c1",
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
    title: `Zadanie ${id}`,
    done,
    done_at: null,
    due_date: "2026-11-17",
    block_id: blockId,
    occurrence_date: "2026-11-17",
    position: 0,
    created_at: null,
  };
}

const biegPlan: SportItem = {
  key: "t:tp1:2026-11-17",
  kind: "run",
  sessionId: null,
  templateId: "tp1",
  title: "Bieg 10 km",
  date: "2026-11-17",
  startMin: 16 * 60,
  durationMin: 60,
  planned: true,
  showInCalendar: true,
  distanceKm: 10,
  durationS: null,
  kcal: null,
  difficulty: null,
  runKind: "easy",
  note: null,
};

// Wtorek 17.11.2026, 10:20
function dane(nadpisz: Partial<TodayData> = {}): TodayData {
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
    nowMin: 10 * 60 + 20,
    weekStartDate: "2026-11-16",
    blocks: [],
    occurrencesToday: [
      wystapienie("b1", 8 * 60, 90, "Matematyka"),
      wystapienie("b2", 10 * 60, 150, "rhytm — kod"),
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
    tasks: [
      zadanie("t1", "b2", true),
      zadanie("t2", "b2", false),
      zadanie("t3", "b2", false),
    ],
    habits: [],
    checks: new Map(),
    sleepLogs: [],
    sportItems: [biegPlan],
    counts: { blocks: 2, habits: 1, workouts: 1, sleepLogs: 1 },
    ...nadpisz,
  };
}

// DayPlan z prawdziwym magazynem Dziś (jak w TodayView)
function Plan({ d }: { d: TodayData }) {
  const { data, applyOptimistic } = useTodayStore(d);
  return <DayPlan data={data} applyOptimistic={applyOptimistic} />;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:20:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("DayPlan", () => {
  it("nagłówek „Plan dnia” z liczbą wpisów i podpowiedzią", () => {
    render(<Plan d={dane()} />);
    expect(
      screen.getByRole("heading", { name: "Plan dnia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "3 bloki · kliknij blok, żeby zobaczyć zadania, albo puste miejsce, żeby dodać",
      ),
    ).toBeInTheDocument();
  });

  it("oś przewija się na trwający blok, „TERAZ” jest na nim, czerwona linia na 10:20", () => {
    render(<Plan d={dane()} />);
    // 48 px na godzinę: 10:00 → 480 px
    expect(screen.getByTestId("os-dnia").scrollTop).toBe(480);
    const trwajacy = screen.getByRole("button", { name: /rhytm — kod/ });
    expect(within(trwajacy).getByText("TERAZ")).toBeInTheDocument();
    expect(
      within(screen.getByRole("button", { name: /Matematyka/ })).queryByText(
        "TERAZ",
      ),
    ).not.toBeInTheDocument();
    expect(within(trwajacy).getByText("1/3")).toBeInTheDocument();
    expect(screen.getByTestId("linia-teraz")).toHaveStyle({
      top: `${(620 / 60) * 48}px`,
    });
    expect(screen.getByTestId("etykieta-teraz")).toHaveTextContent("10:20");
  });

  it("bez trwającego bloku oś przewija się na 06:00", () => {
    render(<Plan d={dane({ nowMin: 7 * 60 })} />);
    expect(screen.getByTestId("os-dnia").scrollTop).toBe(6 * 48);
    expect(screen.queryByText("TERAZ")).not.toBeInTheDocument();
  });

  it("czerwona linia przesuwa się co minutę", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-17T09:20:00Z"));
    render(<Plan d={dane()} />);
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(screen.getByTestId("etykieta-teraz")).toHaveTextContent("10:21");
  });

  it("trening „plan” jest linkiem do podglądu na /sport", () => {
    render(<Plan d={dane()} />);
    const link = screen.getByRole("link", { name: /Bieg 10 km/ });
    expect(link).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-11&wybrany=t:tp1:2026-11-17",
    );
    expect(within(link).getByText("plan")).toBeInTheDocument();
  });

  it("klik w blok otwiera dymek; odhaczenie zadania zmienia „x/y” na osi od razu", async () => {
    toggleTask.mockResolvedValue({ ok: true });
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /rhytm — kod/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByLabelText("Zadanie t2"));
    expect(toggleTask).toHaveBeenCalledWith({ id: "t2", done: true });
    expect(
      within(
        screen.getByRole("button", { name: /rhytm — kod/, pressed: true }),
      ).getByText("2/3"),
    ).toBeInTheDocument();
  });

  it("błąd odhaczenia w dymku cofa „x/y” i pokazuje toast", async () => {
    toggleTask.mockResolvedValue({ ok: false, message: "x" });
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /rhytm — kod/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByLabelText("Zadanie t2"));
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(
      within(
        screen.getByRole("button", { name: /rhytm — kod/, pressed: true }),
      ).getByText("1/3"),
    ).toBeInTheDocument();
  });

  it("„Edytuj” w dymku otwiera okno edycji bloku", async () => {
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /Matematyka/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(
      within(dymek).getByRole("button", { name: "Edytuj" }),
    );
    const okno = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "08:00",
    );
  });

  it("„Usuń” w dymku pyta o potwierdzenie, a usunięcie odświeża plan", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /Matematyka/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByRole("button", { name: "Usuń" }));
    const okno = await screen.findByRole("alertdialog");
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith(
      expect.objectContaining({ blockId: "b1", delete: true }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("klik w pusty slot (co 15 min) otwiera „Nowy wpis”; „Blok” otwiera okno na tę godzinę, zapis odświeża plan", async () => {
    createBlock.mockResolvedValue({ ok: true, id: "b9" });
    render(<Plan d={dane()} />);
    // 12 px na kwadrans: 13:15 = 53 kwadranse → 636 px
    fireEvent.click(screen.getByTestId("siatka-dnia"), { clientY: 640 });
    const dymek = await screen.findByRole("dialog", { name: "Nowy wpis" });
    expect(within(dymek).getByText("wt 17.11 · 13:15")).toBeInTheDocument();
    expect(within(dymek).getByRole("link", { name: /Bieg/ })).toHaveAttribute(
      "href",
      "/sport?nowy=bieg&data=2026-11-17&godzina=13:15",
    );
    await userEvent.click(within(dymek).getByRole("button", { name: /Blok/ }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "13:15",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "14:15",
    );
    await userEvent.type(within(okno).getByLabelText("Tytuł"), "Algebra");
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz blok" }),
    );
    expect(createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-11-17",
        startMin: 13 * 60 + 15,
        durationMin: 60,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("ponowny klik w ten sam slot zamyka „Nowy wpis”", async () => {
    render(<Plan d={dane()} />);
    fireEvent.click(screen.getByTestId("siatka-dnia"), { clientY: 640 });
    await screen.findByRole("dialog", { name: "Nowy wpis" });
    fireEvent.click(screen.getByTestId("siatka-dnia"), { clientY: 640 });
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Nowy wpis" }),
      ).not.toBeInTheDocument(),
    );
  });
});
