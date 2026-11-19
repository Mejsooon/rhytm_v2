import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBlock, changeOccurrence, createCategory, refresh, toggleTask } =
  vi.hoisted(() => ({
    createBlock: vi.fn(),
    changeOccurrence: vi.fn(),
    createCategory: vi.fn(),
    refresh: vi.fn(),
    toggleTask: vi.fn(),
  }));
vi.mock("@/features/calendar/actions", () => ({
  createBlock,
  changeOccurrence,
}));
vi.mock("@/features/categories/actions", () => ({ createCategory }));
vi.mock("@/features/tasks/actions", () => ({
  toggleTask,
  addTask: vi.fn(),
  deleteTask: vi.fn(),
  unpinTask: vi.fn(),
  createStandaloneTask: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import type { TodayData } from "./load-today";
import { TodayView } from "./today-view";

// Wtorek 17.11.2026, 10:20, tydzień od poniedziałku 16.11
function dane(counts: TodayData["counts"]): TodayData {
  return {
    profile: {
      timezone: "Europe/Warsaw",
      weekStart: "mon",
      clock: "24",
      displayName: "Mejson",
      avatarPath: null,
      sleepGoalMin: 480,
      kmGoalOn: true,
      weeklyKmGoal: 25,
      workoutsGoalOn: false,
      weeklyWorkoutsGoal: 3,
      createdAt: "2026-11-01T10:00:00Z",
    },
    today: "2026-11-17",
    nowMin: 10 * 60 + 20,
    weekStartDate: "2026-11-16",
    blocks: [],
    occurrencesToday: [],
    categories: [],
    tasks: [
      {
        id: "t1",
        user_id: "u1",
        title: "Zrobione",
        done: true,
        due_date: "2026-11-17",
        block_id: null,
        position: 1,
        done_at: null,
        occurrence_date: null,
        created_at: null,
      },
      {
        id: "t2",
        user_id: "u1",
        title: "Niezrobione",
        done: false,
        due_date: "2026-11-18",
        block_id: null,
        position: 2,
        done_at: null,
        occurrence_date: null,
        created_at: null,
      },
    ],
    habits: [],
    checks: new Map(),
    sleepLogs: [],
    sportItems: [],
    counts,
  };
}

const wszystko = { blocks: 2, habits: 1, workouts: 1, sleepLogs: 1 };
const nic = { blocks: 0, habits: 0, workouts: 0, sleepLogs: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  // Zegar: 17.11.2026 10:20 w Warszawie (09:20 UTC); udajemy tylko Date, żeby userEvent działał
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:20:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("TodayView", () => {
  it("pełny widok: nagłówek „wtorek · 17.11.2026 · tydz. 47” i karta „Ten tydzień”", () => {
    render(<TodayView data={dane(wszystko)} name="Mejson" />);
    // Drzewo web (telefon ma własne testy w mobile/m-today.test.tsx)
    const web = within(screen.getByTestId("web-dzis"));
    expect(web.getByRole("heading", { name: "Dziś" })).toBeInTheDocument();
    expect(web.getByText("wtorek · 17.11.2026 · tydz. 47")).toBeInTheDocument();
    expect(
      web.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
    // Kafelek „Zadania” z weekTiles: 1 z 2 zadań tygodnia, dziś 1/1
    expect(web.getByText("1/2")).toBeInTheDocument();
    expect(web.getByText("50% · dziś 1/1")).toBeInTheDocument();
    expect(screen.queryByText(/Witaj w rhytm/)).not.toBeInTheDocument();
  });

  it("przed pierwszymi krokami (konto młodsze niż 7 dni) zostaje EmptyToday", () => {
    const d = dane({ blocks: 1, habits: 1, workouts: 0, sleepLogs: 0 });
    d.profile.createdAt = "2026-11-14T10:00:00Z";
    render(<TodayView data={d} name="Mejson" />);
    expect(screen.getByText("Witaj w rhytm, Mejson")).toBeInTheDocument();
    expect(screen.getByText("2 / 4")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Ten tydzień" }),
    ).not.toBeInTheDocument();
  });

  it("konto starsze niż 7 dni z jednym blokiem pokazuje pełny widok", () => {
    // Konto z 01.11, dziś 17.11 → 16 dni
    render(
      <TodayView
        data={dane({ blocks: 1, habits: 0, workouts: 0, sleepLogs: 0 })}
        name="Mejson"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
  });

  it("„Nowy blok” otwiera okno bloku na dziś, na najbliższą pełną godzinę, a zapis odświeża stronę", async () => {
    createBlock.mockResolvedValue({ ok: true, id: "b9" });
    render(<TodayView data={dane(wszystko)} name="Mejson" />);
    await userEvent.click(screen.getByRole("button", { name: "Nowy blok" }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(
      within(okno).getByRole("button", { name: "Dzień" }),
    ).toHaveTextContent("17.11.2026");
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "11:00",
    );
    expect(within(okno).getByRole("button", { name: "Do" })).toHaveTextContent(
      "12:00",
    );

    await userEvent.type(within(okno).getByLabelText("Tytuł"), "Algebra");
    await userEvent.click(
      within(okno).getByRole("button", { name: "Zapisz blok" }),
    );
    expect(createBlock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Algebra",
        date: "2026-11-17",
        startMin: 11 * 60,
        durationMin: 60,
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("„Nowy blok” bierze bieżącą godzinę, a nie tę z chwili wczytania strony", async () => {
    // Strona wczytana o 10:20, kliknięcie o 14:05
    vi.setSystemTime(new Date("2026-11-17T13:05:00Z"));
    render(<TodayView data={dane(wszystko)} name="Mejson" />);
    await userEvent.click(screen.getByRole("button", { name: "Nowy blok" }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "15:00",
    );
  });

  it("„Nowy blok” w stanie pustym też otwiera okno, Anuluj zamyka bez odświeżania", async () => {
    render(<TodayView data={dane(nic)} name="Mejson" />);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    await screen.findByRole("dialog", { name: "Nowy blok" });
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("odhaczenie zadania w dymku bloku zmienia od razu „x/y” na osi i kafelek „Zadania”", async () => {
    toggleTask.mockResolvedValue({ ok: true });
    const d = dane(wszystko);
    d.occurrencesToday = [
      {
        key: "b1:2026-11-17",
        blockId: "b1",
        date: "2026-11-17",
        startMin: 10 * 60,
        durationMin: 120,
        title: "rhytm — kod",
        categoryId: null,
        note: null,
        remind: false,
        recurring: false,
        recurrence: null,
        modified: false,
      },
    ];
    d.tasks.push({
      id: "t3",
      user_id: "u1",
      title: "Testy RLS",
      done: false,
      due_date: "2026-11-17",
      block_id: "b1",
      position: 1,
      done_at: null,
      occurrence_date: "2026-11-17",
      created_at: null,
    });
    render(<TodayView data={d} name="Mejson" />);
    const web = within(screen.getByTestId("web-dzis"));
    // Tydzień: 1 z 3, dziś 1/2; blok 0/1
    expect(web.getByText("1/3")).toBeInTheDocument();
    expect(web.getByText("33% · dziś 1/2")).toBeInTheDocument();
    const blok = web.getByRole("button", { name: /rhytm — kod/ });
    expect(within(blok).getByText("0/1")).toBeInTheDocument();

    await userEvent.click(blok);
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByLabelText("Testy RLS"));
    expect(within(blok).getByText("1/1")).toBeInTheDocument();
    expect(web.getByText("2/3")).toBeInTheDocument();
    expect(web.getByText("67% · dziś 2/2")).toBeInTheDocument();
    // Telefon liczy z tych samych danych: kafelek „Zadania” dziś 2/2
    expect(
      within(screen.getByTestId("m-dzis")).getByRole("link", {
        name: /^Zadania/,
      }),
    ).toHaveTextContent("Zadania2/2");
  });

  it("jeden zegar co minutę dla obu drzew; po północy jedno odświeżenie", () => {
    vi.useFakeTimers();
    // 10:20:45 — następna pełna minuta za 15 s
    vi.setSystemTime(new Date("2026-11-17T09:20:45Z"));
    const d = dane(wszystko);
    d.occurrencesToday = [
      {
        key: "b1:2026-11-17",
        blockId: "b1",
        date: "2026-11-17",
        startMin: 10 * 60,
        durationMin: 120,
        title: "rhytm — kod",
        categoryId: null,
        note: null,
        remind: false,
        recurring: false,
        recurrence: null,
        modified: false,
      },
    ];
    render(<TodayView data={d} name="Mejson" />);
    const web = within(screen.getByTestId("web-dzis"));
    const tel = within(screen.getByTestId("m-dzis"));
    expect(web.getByTestId("etykieta-teraz")).toHaveTextContent("10:20");
    expect(tel.getByText("10:00–12:00 · zostało 100 min")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(14_999);
    });
    expect(web.getByTestId("etykieta-teraz")).toHaveTextContent("10:20");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(web.getByTestId("etykieta-teraz")).toHaveTextContent("10:21");
    expect(tel.getByText("10:00–12:00 · zostało 99 min")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(web.getByTestId("etykieta-teraz")).toHaveTextContent("10:22");
    expect(refresh).not.toHaveBeenCalled();

    // Przeskok za północ (Warszawa): następny tik widzi inny dzień → jedno odświeżenie
    vi.setSystemTime(new Date("2026-11-17T23:00:30Z"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });
});
