import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toggleTask, setHabitCheck, refresh, toastError } = vi.hoisted(() => ({
  toggleTask: vi.fn(),
  setHabitCheck: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("@/features/calendar/actions", () => ({
  createBlock: vi.fn(),
  changeOccurrence: vi.fn(),
}));
vi.mock("@/features/categories/actions", () => ({ createCategory: vi.fn() }));
vi.mock("@/features/tasks/actions", () => ({
  toggleTask,
  addTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock("@/features/habits/actions", () => ({ setHabitCheck }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import {
  kategoria,
  trening,
  wystapienie,
} from "@/features/calendar/mobile/fixtures";
import type { Habit } from "@/features/habits/model";
import type { TaskRow } from "@/features/tasks/model";
import type { TodayData } from "../load-today";
import { TodayView } from "../today-view";
import { MToday } from "./m-today";

function zadanie(
  id: string,
  title: string,
  done: boolean,
  nadpisz: Partial<TaskRow> = {},
): TaskRow {
  return {
    id,
    user_id: "u1",
    title,
    done,
    due_date: "2026-11-17",
    block_id: "bx",
    position: 1,
    done_at: null,
    occurrence_date: "2026-11-17",
    created_at: null,
    ...nadpisz,
  };
}

function nawyk(
  id: string,
  name: string,
  schedule: Habit["schedules"][number],
  showOnToday = true,
): Habit {
  return {
    id,
    name,
    remindAt: null,
    showOnToday,
    createdAt: "2026-11-01T10:00:00Z",
    schedules: [schedule],
  };
}

const codziennie = {
  validFrom: "2026-11-01",
  type: "daily" as const,
  weekdays: [],
  timesPerWeek: null,
};

// Wtorek 17.11.2026, 10:20 (Warszawa), tydzień od poniedziałku 16.11
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
    },
    today: "2026-11-17",
    nowMin: 10 * 60 + 20,
    weekStartDate: "2026-11-16",
    blocks: [
      {
        id: "b1",
        start_local: "2026-11-17T09:30:00",
      } as TodayData["blocks"][number],
    ],
    occurrencesToday: [
      wystapienie(
        "b0:2026-11-17",
        "2026-11-17",
        8 * 60,
        30,
        "Poranna rutyna",
        null,
      ),
      wystapienie(
        "b1:2026-11-17",
        "2026-11-17",
        9 * 60 + 30,
        120,
        "rhytm — kod",
        "c1",
      ),
      wystapienie(
        "b2:2026-11-17",
        "2026-11-17",
        19 * 60,
        60,
        "Bazy danych — projekt",
        "c2",
      ),
    ],
    categories: [
      kategoria("c1", "Własne", "#15803d"),
      kategoria("c2", "Studia", "#0070f3"),
    ],
    tasks: [
      zadanie("t1", "Okno „+ Pole”", true, {
        block_id: "b1",
        occurrence_date: "2026-11-17",
        position: 1,
      }),
      zadanie("t2", "Testy RLS", false, {
        block_id: "b1",
        occurrence_date: "2026-11-17",
        position: 2,
      }),
      zadanie("t3", "Schemat ERD", false, {
        block_id: "b2",
        occurrence_date: "2026-11-17",
      }),
      // Zaległe — nie liczy się w kafelku dziś
      zadanie("t4", "Stare", false, { due_date: "2026-11-10" }),
    ],
    habits: [
      nawyk("h1", "Woda 2 l", codziennie),
      nawyk("h2", "Angielski", {
        validFrom: "2026-11-01",
        type: "times_per_week",
        weekdays: [],
        timesPerWeek: 4,
      }),
      nawyk("h3", "Rozciąganie", codziennie),
      // Ukryty na Dziś — liczy się w kafelku, ale nie ma go na liście
      nawyk("h4", "Ukryty", codziennie, false),
      // Tylko w soboty — dziś (wtorek) niezaplanowany
      nawyk("h5", "Sobotni", {
        validFrom: "2026-11-01",
        type: "weekdays",
        weekdays: [6],
        timesPerWeek: null,
      }),
    ],
    checks: new Map([
      // Woda: 15, 16 i 17.11 → seria 3 dni
      ["h1", new Set(["2026-11-15", "2026-11-16", "2026-11-17"])],
      // Angielski: 2 razy w tym tygodniu
      ["h2", new Set(["2026-11-16", "2026-11-17"])],
    ]),
    sleepLogs: [
      {
        date: "2026-11-17",
        sleptAt: "23:30",
        wokeAt: "06:42",
        feeling: null,
      } as TodayData["sleepLogs"][number],
    ],
    sportItems: [
      // Wykonany bieg 18,4 km w poniedziałek
      trening({
        key: "s:s1",
        date: "2026-11-16",
        distanceKm: 18.4,
        durationS: 6000,
      }),
      // Plan na dziś o 16:00
      trening({
        key: "s:s2",
        sessionId: "s2",
        date: "2026-11-17",
        startMin: 16 * 60,
        durationMin: 60,
        title: "Bieg 10 km",
        planned: true,
        distanceKm: 10,
        durationS: null,
      }),
    ],
  };
}

function telefon() {
  return within(screen.getByTestId("m-dzis"));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-17T09:20:00Z"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MToday", () => {
  it("drzewa web i telefonu są rozdzielone wyłącznie klasami 800 px", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    expect(screen.getByTestId("m-dzis").className).toContain(
      "min-[800px]:hidden",
    );
    expect(screen.getByTestId("web-dzis").className).toContain(
      "max-[799px]:hidden",
    );
  });

  it("tło ekranu #fafafa i przezroczysty nagłówek bez ramki", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const naglowek = telefon().getByRole("banner");
    expect(naglowek.className).toContain("bg-transparent");
    expect(naglowek.className).toContain("border-b-0");
    expect(naglowek.parentElement?.className).toContain("bg-[#fafafa]");
  });

  it("nagłówek: data „Wtorek · 17 listopada”, tytuł „Dziś”, szukaj → /szukaj, awatar z inicjałem → /ustawienia (indeks)", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    expect(t.getByText("Wtorek · 17 listopada")).toBeInTheDocument();
    expect(t.getByRole("heading", { name: "Dziś" })).toBeInTheDocument();
    const szukaj = t.getByRole("link", { name: "Szukaj" });
    expect(szukaj).toHaveAttribute("href", "/szukaj");
    expect(szukaj.className).toContain("size-11");
    const konto = t.getByRole("link", { name: "Konto i ustawienia" });
    expect(konto).toHaveAttribute("href", "/ustawienia");
    expect(konto.className).toContain("size-11");
    expect(konto).toHaveTextContent("M");
  });

  it("awatar ze zdjęciem z profilu", () => {
    render(
      <TodayView
        data={dane()}
        name="Mejson"
        avatarUrl="https://x.test/a.png"
      />,
    );
    const konto = telefon().getByRole("link", { name: "Konto i ustawienia" });
    expect(konto.querySelector("img")).toHaveAttribute(
      "src",
      "https://x.test/a.png",
    );
  });

  it("„Ten tydzień”: zakres dni i cztery paski z wartościami", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const sekcja = telefon().getByRole("region", { name: "Ten tydzień" });
    expect(within(sekcja).getByText("pn 16 – nd 22.11")).toBeInTheDocument();
    expect(
      within(sekcja)
        .getAllByRole("progressbar")
        .map((p) => p.getAttribute("aria-label")),
    ).toEqual(["Treningi", "Bieg", "Nawyki", "Sen"]);
    // Bieg: 18,4 z 25 km → zostało 6,6
    expect(within(sekcja).getByText("18,4")).toBeInTheDocument();
    expect(within(sekcja).getByText("/ 25 km")).toBeInTheDocument();
    expect(within(sekcja).getByText("jeszcze 6,6 km")).toBeInTheDocument();
    // Sen: 23:30 → 06:42 = 7:12
    expect(within(sekcja).getByText("7:12")).toBeInTheDocument();
  });

  it("„Nawyki na dziś”: kafelki z aria-pressed, serią i licznikiem", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const sekcja = telefon().getByRole("region", { name: "Nawyki na dziś" });
    const kafelki = within(sekcja).getAllByRole("button");
    expect(kafelki.map((k) => k.textContent)).toEqual([
      "Woda 2 l3 dni z rzędu",
      "Angielskizacznij passę",
      "Rozciąganiezacznij passę",
    ]);
    expect(kafelki[0]).toHaveAttribute("aria-pressed", "true");
    expect(kafelki[2]).toHaveAttribute("aria-pressed", "false");
    // Odhaczone dziś: Woda i Angielski
    expect(within(sekcja).getByText("2 / 3")).toBeInTheDocument();
  });

  it("odhaczenie nawyku zmienia od razu kafelek i licznik; błąd cofa i pokazuje toast", async () => {
    let zakoncz: (v: { ok: boolean }) => void = () => {};
    setHabitCheck.mockReturnValue(
      new Promise((r) => {
        zakoncz = r;
      }),
    );
    render(<TodayView data={dane()} name="Mejson" />);
    const sekcja = telefon().getByRole("region", { name: "Nawyki na dziś" });
    const kafelek = within(sekcja).getByRole("button", { name: /Rozciąganie/ });
    await userEvent.click(kafelek);
    expect(setHabitCheck).toHaveBeenCalledWith("h3", "2026-11-17", true);
    expect(kafelek).toHaveAttribute("aria-pressed", "true");
    expect(within(sekcja).getByText("3 / 3")).toBeInTheDocument();
    expect(within(sekcja).getByText("1 dzień z rzędu")).toBeInTheDocument();

    zakoncz({ ok: false });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(kafelek).toHaveAttribute("aria-pressed", "false");
    expect(within(sekcja).getByText("2 / 3")).toBeInTheDocument();
  });

  it("plan dnia: licznik wpisów, przerwy, wpisy po godzinie z kategorią, „Teraz” i „x/y”", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const plan = telefon().getByRole("region", { name: "Plan dnia" });
    expect(within(plan).getByText("00:00–24:00 · 4 bloki")).toBeInTheDocument();
    // Przerwa przed pierwszym wpisem: 00:00–08:00
    expect(within(plan).getByText("8 h wolne")).toBeInTheDocument();
    const blok = within(plan).getByRole("button", { name: /rhytm — kod/ });
    // 09:30–11:30, teraz 10:20 → trwa
    expect(blok).toHaveTextContent("Teraz");
    expect(blok).toHaveTextContent("09:30–11:30 · Własne");
    expect(blok).toHaveTextContent("1/2");
    expect(blok.className).toContain("min-h-11");
    expect(
      within(plan).getByRole("button", { name: /Poranna rutyna/ }),
    ).toHaveTextContent("08:00–08:30 · Bez kategorii");
    // Trening prowadzi do Sportu
    const bieg = within(plan).getByRole("link", { name: /Bieg 10 km/ });
    expect(bieg).toHaveAttribute("href", "/sport?miesiac=2026-11&wybrany=s:s2");
    expect(bieg).toHaveTextContent("plan");
  });

  it("stuknięcie bloku otwiera szczegóły; zadania odhaczają się optymistycznie, a błąd cofa zmianę", async () => {
    toggleTask.mockResolvedValue({ ok: false, message: "x" });
    render(<TodayView data={dane()} name="Mejson" />);
    const plan = telefon().getByRole("region", { name: "Plan dnia" });
    await userEvent.click(
      within(plan).getByRole("button", { name: /rhytm — kod/ }),
    );
    const szczegoly = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    expect(within(szczegoly).getByText("Zadania · 1 z 2")).toBeInTheDocument();
    const testy = within(szczegoly).getByRole("checkbox", {
      name: "Testy RLS",
    });
    expect(testy).toHaveAttribute("aria-checked", "false");
    await userEvent.click(testy);
    expect(toggleTask).toHaveBeenCalledWith({ id: "t2", done: true });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(testy).toHaveAttribute("aria-checked", "false");
  });

  it("„Edytuj” w szczegółach otwiera arkusz bloku w trybie edycji", async () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const plan = telefon().getByRole("region", { name: "Plan dnia" });
    await userEvent.click(
      within(plan).getByRole("button", { name: /rhytm — kod/ }),
    );
    const szczegoly = await screen.findByRole("dialog", {
      name: "Szczegóły bloku",
    });
    await userEvent.click(
      within(szczegoly).getByRole("button", { name: "Edytuj" }),
    );
    const arkusz = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(arkusz).getByDisplayValue("rhytm — kod")).toBeInTheDocument();
    await userEvent.click(
      within(arkusz).getAllByRole("button", { name: "Anuluj" })[0],
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("pusty dzień (CMEmptyToday): „Nie masz jeszcze bloków na dziś.”, „Dodaj pierwszy blok” i „Utwórz nowy nawyk”", async () => {
    const d = dane();
    d.occurrencesToday = [];
    d.sportItems = [];
    d.habits = [];
    d.tasks = [];
    const onNewHabit = vi.fn();
    render(
      <MToday
        data={d}
        nowMin={d.nowMin}
        name="Mejson"
        avatarUrl={null}
        applyOptimistic={vi.fn()}
        onToggleHabit={vi.fn()}
        onQuickAdd={vi.fn()}
        onNewHabit={onNewHabit}
      />,
    );
    expect(
      screen.getByText("Nie masz jeszcze bloków na dziś."),
    ).toBeInTheDocument();
    expect(screen.getByText("00:00–24:00 · 0 bloków")).toBeInTheDocument();
    expect(screen.getByText("00:00–24:00 · 24 h wolne")).toBeInTheDocument();
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole("button", { name: "Utwórz nowy nawyk" }),
    );
    expect(onNewHabit).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj pierwszy blok" }),
    );
    expect(
      await screen.findByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
  });

  it("pływający „+” (Szybko dodaj) woła onQuickAdd", async () => {
    const onQuickAdd = vi.fn();
    const d = dane();
    render(
      <MToday
        data={d}
        nowMin={d.nowMin}
        name="Mejson"
        avatarUrl={null}
        applyOptimistic={vi.fn()}
        onToggleHabit={vi.fn()}
        onQuickAdd={onQuickAdd}
        onNewHabit={vi.fn()}
      />,
    );
    const plus = screen.getByRole("button", { name: "Szybko dodaj" });
    expect(plus.className).toContain("m-fab");
    await userEvent.click(plus);
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });
});
