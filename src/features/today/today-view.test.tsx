import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  replace,
  createBlock,
  changeOccurrence,
  createCategory,
  refresh,
  toggleTask,
  setHabitCheck,
  createHabit,
} = vi.hoisted(() => ({
  replace: vi.fn(),
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
  createCategory: vi.fn(),
  refresh: vi.fn(),
  toggleTask: vi.fn(),
  setHabitCheck: vi.fn(),
  createHabit: vi.fn(),
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
}));
vi.mock("@/features/habits/actions", () => ({
  setHabitCheck,
  createHabit,
  updateHabit: vi.fn(),
}));
vi.mock("sonner", () => ({ toast: { error: vi.fn() } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn(), replace }),
}));

import type { Habit } from "@/features/habits/model";
import type { TodayData } from "./load-today";
import { TodayView } from "./today-view";

// Wtorek 17.11.2026, 10:20, tydzień od poniedziałku 16.11
function dane(): TodayData {
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
      fromHour: 7,
      toHour: 23,
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
        block_id: "bx",
        position: 1,
        done_at: null,
        occurrence_date: "2026-11-17",
        created_at: null,
      },
      {
        id: "t2",
        user_id: "u1",
        title: "Niezrobione",
        done: false,
        due_date: "2026-11-18",
        block_id: "bx",
        position: 2,
        done_at: null,
        occurrence_date: "2026-11-18",
        created_at: null,
      },
    ],
    habits: [],
    checks: new Map(),
    sleepLogs: [],
    sportItems: [],
  };
}

// Nawyk codzienny od 1.11
function nawyk(id: string, name: string): Habit {
  return {
    id,
    name,
    remindAt: null,
    showOnToday: true,
    createdAt: "2026-11-01T10:00:00Z",
    schedules: [
      {
        validFrom: "2026-11-01",
        type: "daily",
        weekdays: [],
        timesPerWeek: null,
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  // Zegar: 17.11.2026 10:20 w Warszawie (09:20 UTC); udajemy tylko Date, żeby userEvent działał
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:20:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("TodayView — ?szybko=blok", () => {
  it("na telefonie otwiera arkusz szybkiego dodawania i czyści adres", () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<TodayView data={dane()} name="Mejson" openOnLoad="blok" />);
    expect(
      screen.getByRole("dialog", { name: "Szybko dodaj" }),
    ).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/dzis");
  });

  it("na webie otwiera okno nowego bloku i czyści adres", async () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    render(<TodayView data={dane()} name="Mejson" openOnLoad="blok" />);
    expect(
      await screen.findByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
    expect(replace).toHaveBeenCalledWith("/dzis");
  });

  it("bez parametru nic się nie otwiera i adres zostaje", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});

describe("TodayView", () => {
  it("pełny widok: nagłówek: sam tytuł „Dziś” (bez „Moduły /”) z odznaką „wtorek · 17.11.2026” i „tydz. 47” oraz karta „Ten tydzień”", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    // Drzewo web (telefon ma własne testy w mobile/m-today.test.tsx)
    const web = within(screen.getByTestId("web-dzis"));
    expect(web.getByRole("heading", { name: "Dziś" })).toBeInTheDocument();
    expect(web.queryByText("Moduły")).not.toBeInTheDocument();
    // CToday: odznaka .bdg.sec.lg.num z datą i .hint.num z numerem tygodnia
    expect(web.getByText("wtorek · 17.11.2026")).toHaveClass(
      "h-[22px]",
      "bg-muted",
      "tabular-nums",
    );
    expect(web.getByText("tydz. 47")).toHaveClass(
      "text-xs",
      "text-muted-foreground",
      "tabular-nums",
    );
    expect(
      web.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
    // Kolejność sekcji jak w S2Today: Ten tydzień, Nawyki na dziś, Plan dnia
    expect(
      web.getAllByRole("heading", { level: 2 }).map((h) => h.textContent),
    ).toEqual(["Ten tydzień", "Nawyki na dziś", "Plan dnia"]);
    // Ten tydzień: 4 paski (cel km 25 włączony, treningi bez celu)
    expect(
      web.getAllByTestId("wiersz-tygodnia").map((w) => w.textContent),
    ).toEqual([
      "Treningi0bez zmian—",
      "Bieg0 / 25 kmbez zmianjeszcze 25 km",
      "Nawyki0 % dni z celem—",
      "Sen— / 8:00 śr.brak wpisów",
    ]);
    expect(screen.queryByText(/Witaj w rhytm/)).not.toBeInTheDocument();
  });

  it("nowe konto bez niczego widzi pełny układ z zerami: kafelek „Utwórz nowy nawyk” i „Dodaj pierwszy blok”", () => {
    const d = dane();
    d.tasks = [];
    render(<TodayView data={d} name="Mejson" />);
    const web = within(screen.getByTestId("web-dzis"));
    expect(
      web.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
    expect(
      web.getByRole("button", { name: "Utwórz nowy nawyk" }),
    ).toBeInTheDocument();
    expect(web.getByText("Brak bloków na dziś")).toBeInTheDocument();
    expect(
      web.getByRole("button", { name: "Dodaj pierwszy blok" }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Witaj w rhytm/)).not.toBeInTheDocument();
  });

  it("nawyk na dziś: klik odhacza od razu (kafelek, licznik, pasek „Nawyki”), błąd nie występuje", async () => {
    setHabitCheck.mockResolvedValue({ ok: true });
    const d = dane();
    d.habits = [nawyk("h1", "Czytanie"), nawyk("h2", "Woda 2 l")];
    render(<TodayView data={d} name="Mejson" />);
    const web = within(screen.getByTestId("web-dzis"));
    expect(web.getByTestId("licznik-nawykow")).toHaveTextContent("0 / 2");
    const czytanie = web.getByRole("button", { name: /Czytanie/ });
    expect(czytanie).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(czytanie);
    expect(setHabitCheck).toHaveBeenCalledWith("h1", "2026-11-17", true);
    expect(czytanie).toHaveAttribute("aria-pressed", "true");
    expect(web.getByTestId("licznik-nawykow")).toHaveTextContent("1 / 2");
    expect(czytanie).toHaveTextContent("1 dzień z rzędu");
  });

  it("nawyki są, ale żaden nie przypada na dziś: kafelek „Utwórz nowy nawyk” otwiera okno, zamknięcie odświeża", async () => {
    const d = dane();
    d.habits = [{ ...nawyk("h1", "Ukryty"), showOnToday: false }];
    render(<TodayView data={d} name="Mejson" />);
    const web = within(screen.getByTestId("web-dzis"));
    expect(web.queryByTestId("licznik-nawykow")).not.toBeInTheDocument();
    await userEvent.click(
      web.getByRole("button", { name: "Utwórz nowy nawyk" }),
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy nawyk" });
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(
      screen.queryByRole("dialog", { name: "Nowy nawyk" }),
    ).not.toBeInTheDocument();
    expect(refresh).toHaveBeenCalled();
  });

  it("„Dodaj pierwszy blok” otwiera to samo okno co „Nowy blok” (najbliższa pełna godzina)", async () => {
    render(<TodayView data={dane()} name="Mejson" />);
    await userEvent.click(
      within(screen.getByTestId("web-dzis")).getByRole("button", {
        name: "Dodaj pierwszy blok",
      }),
    );
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "11:00",
    );
  });

  it("„Nowy blok” otwiera okno bloku na dziś, na najbliższą pełną godzinę, a zapis odświeża stronę", async () => {
    createBlock.mockResolvedValue({ ok: true, id: "b9" });
    render(<TodayView data={dane()} name="Mejson" />);
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
    render(<TodayView data={dane()} name="Mejson" />);
    await userEvent.click(screen.getByRole("button", { name: "Nowy blok" }));
    const okno = await screen.findByRole("dialog", { name: "Nowy blok" });
    expect(within(okno).getByRole("button", { name: "Od" })).toHaveTextContent(
      "15:00",
    );
  });

  it("„Nowy blok” w stanie pustym też otwiera okno, Anuluj zamyka bez odświeżania", async () => {
    render(<TodayView data={dane()} name="Mejson" />);
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    await screen.findByRole("dialog", { name: "Nowy blok" });
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("odhaczenie zadania w dymku bloku zmienia od razu „x/y” na liście i plan dnia telefonu", async () => {
    toggleTask.mockResolvedValue({ ok: true });
    const d = dane();
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
    const blok = web.getByRole("button", { name: /rhytm — kod/ });
    expect(within(blok).getByText("0/1")).toBeInTheDocument();

    await userEvent.click(blok);
    const dymek = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(within(dymek).getByLabelText("Testy RLS"));
    expect(within(blok).getByText("1/1")).toBeInTheDocument();
    // Telefon liczy z tych samych danych: blok w planie dnia też ma 1/1
    expect(
      within(screen.getByTestId("m-dzis")).getByRole("button", {
        name: /rhytm — kod/,
      }),
    ).toHaveTextContent("1/1");
  });

  it("jeden zegar co minutę dla obu drzew; po północy jedno odświeżenie", () => {
    vi.useFakeTimers();
    // 10:20:45 — następna pełna minuta za 15 s
    vi.setSystemTime(new Date("2026-11-17T09:20:45Z"));
    const d = dane();
    // Blok 10:00–10:22: „Teraz” na webie znika o 10:22
    d.occurrencesToday = [
      {
        key: "b1:2026-11-17",
        blockId: "b1",
        date: "2026-11-17",
        startMin: 10 * 60,
        durationMin: 22,
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
    const blok = () => web.getByRole("button", { name: /rhytm — kod/ });
    expect(within(blok()).getByText("Teraz")).toBeInTheDocument();
    const blokTel = () => tel.getByRole("button", { name: /rhytm — kod/ });
    expect(within(blokTel()).getByText("Teraz")).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(14_999);
    });
    expect(within(blokTel()).getByText("Teraz")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(within(blok()).getByText("Teraz")).toBeInTheDocument();
    expect(within(blokTel()).getByText("Teraz")).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(within(blok()).queryByText("Teraz")).not.toBeInTheDocument();
    expect(within(blokTel()).queryByText("Teraz")).not.toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();

    // Przeskok za północ (Warszawa): następny tik widzi inny dzień → jedno odświeżenie
    vi.setSystemTime(new Date("2026-11-17T23:00:30Z"));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it("pływający „+” otwiera arkusz „Szybko dodaj”, a „Zamknij” go zamyka", async () => {
    render(<TodayView data={dane()} name="Mejson" />);
    await userEvent.click(screen.getByRole("button", { name: "Szybko dodaj" }));
    const arkusz = await screen.findByRole("dialog", { name: "Szybko dodaj" });
    // Domyślny rodzaj to „Blok”; chipy liczą się od dziś i teraz z profilu (wtorek 10:20 → Dziś = 11:00, Pn 23.11)
    expect(
      within(arkusz).getByLabelText("Blok w kalendarzu"),
    ).toBeInTheDocument();
    expect(
      within(arkusz).getByRole("button", { name: "Pn 23.11" }),
    ).toBeInTheDocument();
    await userEvent.click(
      within(arkusz).getByRole("button", { name: "Zamknij" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
