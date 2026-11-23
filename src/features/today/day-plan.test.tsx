import {
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
    ...nadpisz,
  };
}

const onNewBlock = vi.fn();

// DayPlan z prawdziwym magazynem Dziś (jak w TodayView)
function Plan({ d }: { d: TodayData }) {
  const { data, applyOptimistic } = useTodayStore(d);
  return (
    <DayPlan
      data={data}
      nowMin={data.nowMin}
      applyOptimistic={applyOptimistic}
      onNewBlock={onNewBlock}
    />
  );
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
  it("nagłówek „Plan dnia” z zakresem doby i liczbą wpisów (trening się liczy)", () => {
    render(<Plan d={dane()} />);
    expect(
      screen.getByRole("heading", { name: "Plan dnia" }),
    ).toBeInTheDocument();
    expect(screen.getByText("00:00–24:00 · 3 bloki")).toBeInTheDocument();
  });

  it("lista: przerwy przed, między i po wpisach, nakładki bez przerwy, na końcu wiersz 23:00", () => {
    render(<Plan d={dane()} />);
    const lista = screen.getByTestId("plan-dnia-lista");
    const wiersze = Array.from(lista.children).map((w) => w.textContent);
    expect(wiersze).toEqual([
      "00:008 h wolne",
      expect.stringMatching(/^08:00Matematyka/),
      // Matematyka 08:00–09:30 i rhytm — kod 10:00–12:30
      "09:3030 min wolne",
      expect.stringMatching(/^10:00rhytm — kod/),
      "12:303 h 30 min wolne",
      expect.stringMatching(/^16:00Bieg 10 km/),
      "17:007 h wolne",
      "23:00",
    ]);
    // ≥ 3 h: wysoka przerwa, krótsza — niska
    const przerwy = within(lista).getAllByTestId("przerwa");
    expect(przerwy[0]).toHaveClass("min-h-[84px]");
    expect(przerwy[1]).toHaveClass("min-h-[30px]");
    // Bez siatki z osią, czerwonej linii i przewijania
    expect(screen.queryByTestId("os-dnia")).not.toBeInTheDocument();
    expect(screen.queryByTestId("linia-teraz")).not.toBeInTheDocument();
  });

  it("blok: tło i ramka w kolorze kategorii, „HH:MM–HH:MM · Kategoria”, odznaka „x/y”", () => {
    const d = dane();
    d.categories = [{ ...d.categories[0], color: "#3b82f6" }];
    render(<Plan d={d} />);
    const blok = screen.getByRole("button", { name: /Matematyka/ });
    // Tło kolor+12, ramka 1 px kolor+4d (jak w kalendarzu)
    expect(blok.style.background).toMatch(
      /#3b82f612|rgba\(59, 130, 246, 0\.07\d*\)/,
    );
    expect(blok.style.border).toMatch(
      /1px solid (#3b82f64d|rgba\(59, 130, 246, 0\.3\d*\))/,
    );
    expect(blok).toHaveClass("rounded-[8px]", "px-2.5", "py-1.5", "text-[13px]");
    expect(blok).toHaveTextContent("08:00–09:30 · Projekty");
    // Matematyka nie ma zadań → bez odznaki; rhytm — kod ma 1 z 3
    expect(blok.textContent).not.toMatch(/\d\/\d/);
    expect(
      within(screen.getByRole("button", { name: /rhytm — kod/ })).getByText(
        "1/3",
      ),
    ).toBeInTheDocument();
  });

  it("trwający blok ma „Teraz” i pierścień, inne nie", () => {
    render(<Plan d={dane()} />);
    const trwajacy = screen.getByRole("button", { name: /rhytm — kod/ });
    expect(within(trwajacy).getByText("Teraz")).toBeInTheDocument();
    expect(trwajacy.style.boxShadow).toMatch(/3px/);
    const inny = screen.getByRole("button", { name: /Matematyka/ });
    expect(within(inny).queryByText("Teraz")).not.toBeInTheDocument();
    expect(inny.style.boxShadow).toBe("");
  });

  it("bez trwającego bloku nie ma „Teraz”", () => {
    render(<Plan d={dane({ nowMin: 7 * 60 })} />);
    expect(screen.queryByText("Teraz")).not.toBeInTheDocument();
  });

  it("zaznaczony blok ma pierścień i fokus jako outline z odstępem", async () => {
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /Matematyka/ }));
    const blok = screen.getByRole("button", {
      name: /Matematyka/,
      pressed: true,
    });
    expect(blok.style.boxShadow).toMatch(/0 0 0 4px #15803d66|0px 0px 0px 4px/);
    expect(blok).toHaveClass(
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-ring",
    );
  });

  it("trening „plan” jest linkiem do podglądu na /sport z „· Sport”", () => {
    render(<Plan d={dane()} />);
    const link = screen.getByRole("link", { name: /Bieg 10 km/ });
    expect(link).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-11&wybrany=t:tp1:2026-11-17",
    );
    expect(link).toHaveTextContent("16:00–17:00 · Sport");
    expect(within(link).getByText("plan")).toBeInTheDocument();
  });

  it("wykonany trening ma odznakę „zrobione”", () => {
    render(<Plan d={dane({ sportItems: [{ ...biegPlan, planned: false }] })} />);
    const link = screen.getByRole("link", { name: /Bieg 10 km/ });
    expect(within(link).getByText("zrobione")).toBeInTheDocument();
  });

  it("klik w blok otwiera dymek; odhaczenie zadania zmienia „x/y” na liście od razu", async () => {
    toggleTask.mockResolvedValue({ ok: true });
    render(<Plan d={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: /rhytm — kod/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    // Blok zajmuje całą szerokość listy, więc dymek otwiera się pod blokiem (nie w prawo, poza stronę)
    expect(dymek).toHaveAttribute("data-side", "bottom");
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

  it("„Usuń” bloku cyklicznego pyta o zakres, usuwa z oryginalną datą i odświeża plan", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    const cykliczny: Occurrence = {
      ...wystapienie("b3", 18 * 60, 90, "Bazy danych"),
      // Wystąpienie z 16.11 przesunięte na dziś (wyjątek)
      key: "b3:2026-11-16",
      recurring: true,
      recurrence: { freq: "daily" },
      modified: true,
    };
    render(
      <Plan
        d={dane({
          occurrencesToday: [...dane().occurrencesToday, cykliczny],
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Bazy danych/ }));
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByRole("button", { name: "Usuń" }));
    const okno = await screen.findByRole("dialog", {
      name: "Usuwasz blok, który się powtarza",
    });
    await userEvent.click(within(okno).getByLabelText(/To i następne/));
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b3",
      date: "2026-11-16",
      scope: "following",
      delete: true,
    });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(
      screen.queryByRole("dialog", {
        name: "Usuwasz blok, który się powtarza",
      }),
    ).not.toBeInTheDocument();
  });

  it("klik w przerwę otwiera „Nowy blok” od pełnej godziny w górę, 60 min; zapis odświeża plan", async () => {
    createBlock.mockResolvedValue({ ok: true, id: "b9" });
    render(<Plan d={dane()} />);
    // Przerwa 12:30–16:00 → od 13:00
    await userEvent.click(
      screen.getByRole("button", { name: "3 h 30 min wolne" }),
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "13:00",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "14:00",
    );
    await userEvent.type(within(okno).getByLabelText("Tytuł"), "Lunch");
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz blok" }),
    );
    expect(createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Lunch",
        date: "2026-11-17",
        startMin: 13 * 60,
        durationMin: 60,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("przerwa od 23:30 otwiera blok najpóźniej o 23:00", async () => {
    render(
      <Plan
        d={dane({
          occurrencesToday: [wystapienie("b1", 0, 23 * 60 + 30, "Długi")],
          sportItems: [],
        })}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "30 min wolne" }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "23:00",
    );
  });

  it("pusty dzień: „24 h wolne”, zachęta i „Dodaj pierwszy blok”, potem 23:00", async () => {
    render(<Plan d={dane({ occurrencesToday: [], sportItems: [] })} />);
    expect(screen.getByText("00:00–24:00 · 0 bloków")).toBeInTheDocument();
    const lista = screen.getByTestId("plan-dnia-lista");
    expect(Array.from(lista.children).map((w) => w.textContent)).toEqual([
      "00:0024 h wolne",
      "Nie masz jeszcze bloków na dziś.Dodaj pierwszy blok",
      "23:00",
    ]);
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj pierwszy blok" }),
    );
    expect(onNewBlock).toHaveBeenCalled();
  });
});
