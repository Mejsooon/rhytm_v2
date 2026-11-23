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

  it("nagłówek: etykieta dnia, tytuł „Dziś”, szukaj → /szukaj, awatar z inicjałem → /ustawienia/ogolne", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    expect(t.getByText("Wtorek · 17 listopada")).toBeInTheDocument();
    expect(t.getByRole("heading", { name: "Dziś" })).toBeInTheDocument();
    expect(t.getByRole("link", { name: "Szukaj" })).toHaveAttribute(
      "href",
      "/szukaj",
    );
    const konto = t.getByRole("link", { name: "Konto i ustawienia" });
    expect(konto).toHaveAttribute("href", "/ustawienia/ogolne");
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

  it("kafelki 2×2 z wartościami i linkami", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    // Nawyki: zaplanowane dziś h1, h3, h4 + odhaczony X/tydz. h2 → 2/4
    const nawyki = t.getByRole("link", { name: /^Nawyki/ });
    expect(nawyki).toHaveAttribute("href", "/nawyki");
    expect(nawyki).toHaveTextContent("Nawyki2/4");
    // Sen: 23:30 → 06:42 = 7:12 h, zakładka Sen
    const sen = t.getByRole("link", { name: /^Sen/ });
    expect(sen).toHaveAttribute("href", "/nawyki?tab=sen");
    expect(sen).toHaveTextContent("Sen7:12 h");
    // Zadania: tylko z terminem dziś (t1–t3) → 1/3
    const zadania = t.getByRole("link", { name: /^Zadania/ });
    expect(zadania).toHaveAttribute("href", "/kalendarz");
    expect(zadania).toHaveTextContent("Zadania1/3");
    const km = t.getByRole("link", { name: /^Km w tyg\./ });
    expect(km).toHaveAttribute("href", "/sport");
    expect(km).toHaveTextContent("Km w tyg.18,4/25");
  });

  it("bez wpisu snu kafelek „—”, bez celu km sama liczba", () => {
    const d = dane();
    d.sleepLogs = [];
    d.profile.kmGoalOn = false;
    render(<TodayView data={d} name="Mejson" />);
    const t = telefon();
    expect(t.getByRole("link", { name: /^Sen/ })).toHaveTextContent("Sen—");
    expect(t.getByRole("link", { name: /^Km w tyg\./ })).toHaveTextContent(
      /^Km w tyg\.18,4$/,
    );
  });

  it("karta Teraz: godziny, „zostało N min” i odhaczanie zadań wystąpienia (optymistycznie)", async () => {
    toggleTask.mockResolvedValue({ ok: true });
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    const karta = t.getByRole("region", { name: "Teraz" });
    // 09:30–11:30, teraz 10:20 → zostało 70 min
    expect(
      within(karta).getByText("09:30–11:30 · zostało 70 min"),
    ).toBeInTheDocument();
    expect(
      within(karta).getByRole("button", { name: "rhytm — kod" }),
    ).toBeInTheDocument();
    const zrobione = within(karta).getByRole("checkbox", {
      name: "Okno „+ Pole”",
    });
    expect(zrobione).toHaveAttribute("aria-checked", "true");
    const testy = within(karta).getByRole("checkbox", { name: "Testy RLS" });
    expect(testy).toHaveAttribute("aria-checked", "false");

    await userEvent.click(testy);
    expect(toggleTask).toHaveBeenCalledWith({ id: "t2", done: true });
    expect(testy).toHaveAttribute("aria-checked", "true");
    // Kafelek „Zadania” zmienia się od razu
    expect(t.getByRole("link", { name: /^Zadania/ })).toHaveTextContent(
      "Zadania2/3",
    );
  });

  it("błąd odhaczenia zadania cofa zmianę i pokazuje toast", async () => {
    toggleTask.mockResolvedValue({ ok: false, message: "x" });
    render(<TodayView data={dane()} name="Mejson" />);
    const karta = telefon().getByRole("region", { name: "Teraz" });
    const testy = within(karta).getByRole("checkbox", { name: "Testy RLS" });
    await userEvent.click(testy);
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(testy).toHaveAttribute("aria-checked", "false");
  });

  it("bez trwającego bloku nie ma karty Teraz", () => {
    const d = dane();
    d.nowMin = 12 * 60;
    vi.setSystemTime(new Date("2026-11-17T11:00:00Z"));
    render(<TodayView data={d} name="Mejson" />);
    expect(
      telefon().queryByRole("region", { name: "Teraz" }),
    ).not.toBeInTheDocument();
  });

  it("stuknięcie w tytuł Teraz otwiera arkusz bloku w trybie edycji", async () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const karta = telefon().getByRole("region", { name: "Teraz" });
    await userEvent.click(
      within(karta).getByRole("button", { name: "rhytm — kod" }),
    );
    const arkusz = await screen.findByRole("dialog", { name: "Edytuj blok" });
    expect(within(arkusz).getByDisplayValue("rhytm — kod")).toBeInTheDocument();
    await userEvent.click(
      within(arkusz).getByRole("button", { name: "Anuluj" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("plan dnia: wpisy po godzinie, zakończone przekreślone, kategoria i „x/y” zadań", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const plan = telefon().getByRole("region", { name: "Plan dnia" });
    expect(
      within(plan).getByRole("link", { name: "Kalendarz" }),
    ).toHaveAttribute("href", "/kalendarz?widok=dzien");
    const wiersze = within(plan)
      .getAllByRole("listitem")
      .map((w) => w.textContent);
    expect(wiersze).toEqual([
      "08:00Poranna rutyna30 min · zrobione",
      "09:30rhytm — kod2 h · Własne · 1/2",
      "16:00Bieg 10 km1 h · Sport",
      "19:00Bazy danych — projekt1 h · Studia · 0/1",
    ]);
    // Zakończony blok (08:00–08:30) jest przekreślony, trwający nie
    expect(within(plan).getByText("Poranna rutyna")).toHaveClass(
      "line-through",
    );
    expect(within(plan).getByText("rhytm — kod")).not.toHaveClass(
      "line-through",
    );
    // Trening prowadzi do Sportu, blok do dnia w kalendarzu
    expect(
      within(plan).getByRole("link", { name: /Bieg 10 km/ }),
    ).toHaveAttribute("href", "/sport?miesiac=2026-11&wybrany=s:s2");
    expect(
      within(plan).getByRole("link", { name: /Bazy danych/ }),
    ).toHaveAttribute("href", "/kalendarz?widok=dzien");
  });

  it("zakończony blok: „zrobione” tylko bez zadań albo przy wszystkich zrobionych", () => {
    const d = dane();
    // Teraz 19:30: rhytm (09:30–11:30, 1/2 zadań) się skończył, Bazy danych trwa
    d.nowMin = 19 * 60 + 30;
    vi.setSystemTime(new Date("2026-11-17T18:30:00Z"));
    const { unmount } = render(<TodayView data={d} name="Mejson" />);
    let plan = telefon().getByRole("region", { name: "Plan dnia" });
    expect(within(plan).getByText("2 h · Własne · 1/2")).toBeInTheDocument();
    expect(within(plan).getByText("rhytm — kod")).toHaveClass("line-through");
    // Trening zaplanowany na 16:00, który minął, nie jest „zrobiony”
    expect(within(plan).getByText("1 h · Sport")).toBeInTheDocument();
    unmount();

    d.tasks = d.tasks.map((t) => (t.id === "t2" ? { ...t, done: true } : t));
    render(<TodayView data={d} name="Mejson" />);
    plan = telefon().getByRole("region", { name: "Plan dnia" });
    expect(within(plan).getAllByText("2 h · zrobione")).toHaveLength(1);
  });

  it("linki „Kalendarz” i „Wszystkie” mają cel dotyku 44 px", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    for (const nazwa of ["Kalendarz", "Wszystkie"]) {
      expect(t.getByRole("link", { name: nazwa }).className).toContain(
        "min-h-11",
      );
    }
  });

  it("pusty plan dnia: „Plan dnia jest pusty”", () => {
    const d = dane();
    d.occurrencesToday = [];
    d.sportItems = [];
    render(<TodayView data={d} name="Mejson" />);
    expect(telefon().getByText("Plan dnia jest pusty")).toBeInTheDocument();
  });

  it("nawyki: zaplanowane dziś i X/tydz., z serią; „Wszystkie” → /nawyki", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const sekcja = telefon().getByRole("region", { name: "Nawyki" });
    expect(
      within(sekcja).getByRole("link", { name: "Wszystkie" }),
    ).toHaveAttribute("href", "/nawyki");
    const pola = within(sekcja).getAllByRole("checkbox");
    expect(pola.map((p) => p.getAttribute("aria-label"))).toEqual([
      "Woda 2 l",
      "Angielski",
      "Rozciąganie",
    ]);
    expect(pola[0]).toHaveAttribute("aria-checked", "true");
    expect(within(sekcja).getByText("3 dni")).toBeInTheDocument();
    expect(within(sekcja).getByText("2/4 tydz.")).toBeInTheDocument();
    expect(within(sekcja).getByText("—")).toBeInTheDocument();
  });

  it("odhaczenie nawyku zmienia od razu listę, serię i kafelek; błąd cofa i pokazuje toast", async () => {
    let zakoncz: (v: { ok: boolean }) => void = () => {};
    setHabitCheck.mockReturnValue(
      new Promise((r) => {
        zakoncz = r;
      }),
    );
    render(<TodayView data={dane()} name="Mejson" />);
    const t = telefon();
    const sekcja = t.getByRole("region", { name: "Nawyki" });
    const pole = within(sekcja).getByRole("checkbox", { name: "Rozciąganie" });
    await userEvent.click(pole);
    expect(setHabitCheck).toHaveBeenCalledWith("h3", "2026-11-17", true);
    expect(pole).toHaveAttribute("aria-checked", "true");
    expect(within(sekcja).getByText("1 dzień")).toBeInTheDocument();
    expect(t.getByRole("link", { name: /^Nawyki/ })).toHaveTextContent(
      "Nawyki3/4",
    );

    zakoncz({ ok: false });
    await waitFor(() =>
      expect(toastError).toHaveBeenCalledWith(
        "Nie udało się zapisać. Spróbuj ponownie.",
      ),
    );
    expect(pole).toHaveAttribute("aria-checked", "false");
    expect(t.getByRole("link", { name: /^Nawyki/ })).toHaveTextContent(
      "Nawyki2/4",
    );
  });

  it("karta biegu: „Bieg o 16:00 · 10 km” i „Cel tygodnia: jeszcze 6,6 km” → /sport", () => {
    render(<TodayView data={dane()} name="Mejson" />);
    const karta = telefon().getByRole("link", { name: /Bieg o 16:00/ });
    expect(karta).toHaveAttribute("href", "/sport");
    expect(karta).toHaveTextContent("Bieg o 16:00 · 10 km");
    expect(karta).toHaveTextContent("Cel tygodnia: jeszcze 6,6 km");
  });

  it("cel i dystans niecałkowite: z przecinkiem", () => {
    const d = dane();
    d.profile.weeklyKmGoal = 30.5;
    d.sportItems[1] = { ...d.sportItems[1], distanceKm: 7.5 };
    render(<TodayView data={d} name="Mejson" />);
    const t = telefon();
    expect(t.getByRole("link", { name: /^Km w tyg\./ })).toHaveTextContent(
      "Km w tyg.18,4/30,5",
    );
    expect(t.getByRole("link", { name: /Bieg o 16:00/ })).toHaveTextContent(
      "Bieg o 16:00 · 7,5 km",
    );
  });

  it("karta biegu: bez planu dziś najbliższy w tygodniu, cel osiągnięty, bez celu bez dopisku", () => {
    const d = dane();
    d.sportItems[1] = {
      ...d.sportItems[1],
      date: "2026-11-19",
      startMin: 18 * 60,
      distanceKm: null,
    };
    d.sportItems[0] = { ...d.sportItems[0], distanceKm: 26 };
    const { unmount } = render(<TodayView data={d} name="Mejson" />);
    const karta = telefon().getByRole("link", { name: /Bieg cz 18:00/ });
    expect(karta).toHaveTextContent("Cel tygodnia osiągnięty");
    unmount();

    d.profile.kmGoalOn = false;
    render(<TodayView data={d} name="Mejson" />);
    expect(
      telefon().getByRole("link", { name: /Bieg cz 18:00/ }),
    ).not.toHaveTextContent("Cel tygodnia");
  });

  it("bez zaplanowanego biegu karta biegu jest ukryta", () => {
    const d = dane();
    d.sportItems = [d.sportItems[0]];
    render(<TodayView data={d} name="Mejson" />);
    expect(
      telefon().queryByRole("link", { name: /^Bieg/ }),
    ).not.toBeInTheDocument();
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
      />,
    );
    const plus = screen.getByRole("button", { name: "Szybko dodaj" });
    // 16 px nad dolnym paskiem
    expect(plus.className).toContain("bottom-[calc(var(--tabbar-h)+16px)]");
    await userEvent.click(plus);
    expect(onQuickAdd).toHaveBeenCalledTimes(1);
  });
});
