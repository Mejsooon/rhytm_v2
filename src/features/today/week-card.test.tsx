import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WeekTiles } from "./model";
import { WeekCard } from "./week-card";

const PRZYSZLOSC = [null, null, null, null, null] as const;

// Wartości jak w makiecie Today.dc.html (wtorek 17.11, tydzień od pn 16.11)
function kafelki(): WeekTiles {
  return {
    tasks: { done: 18, total: 41, percent: 44, todayDone: 4, todayTotal: 12 },
    habits: { percent: 78, above70: 2, plannedDays: 2 },
    sleep: { avgMin: 444, goalMin: 480, nightsAtGoal: 1, nights: 2 },
    run: {
      km: 0,
      goalKm: 25,
      nextRun: { date: "2026-11-17", startMin: 16 * 60, distanceKm: 10 },
    },
    workouts: {
      done: 0,
      total: 4,
      upcoming: [
        { kind: "run", date: "2026-11-17", startMin: 16 * 60 },
        { kind: "gym", date: "2026-11-19", startMin: 18 * 60 },
        { kind: "run", date: "2026-11-21", startMin: 9 * 60 },
      ],
    },
    days: {
      tasks: [9, 4, ...PRZYSZLOSC],
      habits: [{ done: 4, planned: 5 }, { done: 3, planned: 5 }, ...PRZYSZLOSC],
      sleep: [426, 462, ...PRZYSZLOSC],
      km: [0, 0, ...PRZYSZLOSC],
      workouts: [0, 0, ...PRZYSZLOSC],
    },
  };
}

function wyrenderuj(
  t: WeekTiles = kafelki(),
  nadpisz: Partial<{
    weekStartDate: string;
    today: string;
    clock: "24" | "12";
  }> = {},
) {
  render(
    <WeekCard
      tiles={t}
      weekStartDate={nadpisz.weekStartDate ?? "2026-11-16"}
      today={nadpisz.today ?? "2026-11-17"}
      clock={nadpisz.clock ?? "24"}
    />,
  );
}

function kafelek(etykieta: string) {
  return screen
    .getAllByTestId("kafelek-tygodnia")
    .find((k) => within(k).queryByText(etykieta) !== null)!;
}

// Słupki kafelka: [tytuł, wysokość, kolor]
function slupki(etykieta: string) {
  return within(kafelek(etykieta))
    .getAllByTestId("slupek-dnia")
    .map((s) => [s.getAttribute("title"), s.style.height, s.style.background]);
}

const SZARY_PUSTY = "rgba(0, 0, 0, 0.06)";
const ZIELONY = "rgb(21, 128, 61)";
const CIEMNY = "rgb(38, 38, 38)";
const SZARY = "rgba(0, 0, 0, 0.16)";
const jeszczeNie = Array.from({ length: 5 }, () => [
  "jeszcze nie",
  "3px",
  SZARY_PUSTY,
]);

describe("WeekCard", () => {
  it("pokazuje zakres tygodnia i pięć kafelków z wartościami i dopiskami jak w makiecie", () => {
    wyrenderuj();
    expect(
      screen.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
    expect(screen.getByText("pn 16 – nd 22.11")).toBeInTheDocument();
    expect(screen.getAllByTestId("kafelek-tygodnia")).toHaveLength(5);

    const zadania = kafelek("Zadania");
    expect(within(zadania).getByText("18/41")).toBeInTheDocument();
    expect(within(zadania).getByText("44% · dziś 4/12")).toBeInTheDocument();

    const nawyki = kafelek("Nawyki");
    expect(within(nawyki).getByText("78%")).toBeInTheDocument();
    expect(
      within(nawyki).getByText("2 z 2 dni powyżej 70%"),
    ).toBeInTheDocument();

    const sen = kafelek("Śr. sen");
    expect(within(sen).getByText(/7:24/)).toBeInTheDocument();
    expect(within(sen).getByText("/ 8:00")).toBeInTheDocument();
    expect(within(sen).getByText("1 z 2 nocy ≥ cel")).toBeInTheDocument();

    const bieg = kafelek("Bieg");
    expect(within(bieg).getByText(/0,0/)).toBeInTheDocument();
    expect(within(bieg).getByText("/ 25 km")).toBeInTheDocument();
    expect(
      within(bieg).getByText("dziś 16:00 · 10 km w planie"),
    ).toBeInTheDocument();

    const treningi = kafelek("Treningi");
    expect(within(treningi).getByText(/^0/)).toBeInTheDocument();
    expect(within(treningi).getByText("/ 4")).toBeInTheDocument();
    // najwyżej dwa nadchodzące
    expect(
      within(treningi).getByText("bieg dziś, siłownia cz"),
    ).toBeInTheDocument();
  });

  it("kafelki to osobne karty .card z etykietą .lbl i wartością 24 px / 600 tabular-nums (CToday)", () => {
    wyrenderuj();
    const zadania = kafelek("Zadania");
    expect(zadania).toHaveClass("rounded-xl", "border-border", "p-4", "gap-2.5");
    expect(within(zadania).getByText("Zadania")).toHaveClass(
      "text-xs",
      "font-medium",
      "text-muted-foreground",
    );
    expect(within(zadania).getByText("Zadania")).not.toHaveClass("uppercase");
    expect(within(zadania).getByText("18/41")).toHaveClass(
      "text-2xl",
      "font-semibold",
      "tabular-nums",
    );
    expect(screen.getByText("pn 16 – nd 22.11")).not.toHaveClass("font-mono");
  });

  it("słupki 7 dni: wysokość v / max × 28, dziś zielony, przyszłość szara 3 px", () => {
    wyrenderuj();
    // Zadania: max = 9 → 28 px i round(4/9 × 28) = 12 px
    expect(slupki("Zadania")).toEqual([
      ["9", "28px", SZARY],
      ["4", "12px", ZIELONY],
      ...jeszczeNie,
    ]);
    // Nawyki: max = największy plan dnia (5); dzień > 70% ciemny
    expect(slupki("Nawyki")).toEqual([
      ["4/5", "22px", CIEMNY],
      ["3/5", "17px", ZIELONY],
      ...jeszczeNie,
    ]);
    // Sen: max = cel + 1 h = 540 min; poniżej celu szary
    expect(slupki("Śr. sen")).toEqual([
      ["7:06", "22px", SZARY],
      ["7:42", "24px", ZIELONY],
      ...jeszczeNie,
    ]);
    // Zero km: słupek minimalny 3 px
    expect(slupki("Bieg")).toEqual([
      ["0 km", "3px", SZARY],
      ["0 km", "3px", ZIELONY],
      ...jeszczeNie,
    ]);
    expect(slupki("Treningi")).toEqual([
      ["0", "3px", SZARY],
      ["0", "3px", ZIELONY],
      ...jeszczeNie,
    ]);
  });

  it("sen ≥ cel ciemny, noc bez wpisu przed dziś: „brak wpisu”", () => {
    const t = kafelki();
    t.days.sleep = [500, null, 470, null, null, null, null];
    wyrenderuj(t, { today: "2026-11-18" });
    expect(slupki("Śr. sen").slice(0, 3)).toEqual([
      ["8:20", "26px", CIEMNY],
      ["brak wpisu", "3px", SZARY_PUSTY],
      ["7:50", "24px", ZIELONY],
    ]);
  });

  it("bez celu km nie pokazuje „/ cel”; plan biegu bez dystansu to sama godzina", () => {
    const t = kafelki();
    t.run = {
      km: 12.4,
      goalKm: null,
      nextRun: { date: "2026-11-19", startMin: 18 * 60 + 30, distanceKm: null },
    };
    wyrenderuj(t);
    const bieg = kafelek("Bieg");
    expect(within(bieg).getByText(/12,4/)).toBeInTheDocument();
    expect(within(bieg).queryByText(/\//)).not.toBeInTheDocument();
    expect(within(bieg).getByText("cz 18:30")).toBeInTheDocument();
  });

  it("bez planów: „brak zaplanowanych” i „brak w planie”", () => {
    const t = kafelki();
    t.run.nextRun = null;
    t.workouts.upcoming = [];
    wyrenderuj(t);
    expect(
      within(kafelek("Bieg")).getByText("brak zaplanowanych"),
    ).toBeInTheDocument();
    expect(
      within(kafelek("Treningi")).getByText("brak w planie"),
    ).toBeInTheDocument();
  });

  it("trening jutro nazywa się „jutro”", () => {
    const t = kafelki();
    t.workouts.upcoming = [
      { kind: "gym", date: "2026-11-18", startMin: 18 * 60 },
    ];
    wyrenderuj(t);
    expect(
      within(kafelek("Treningi")).getByText("siłownia jutro"),
    ).toBeInTheDocument();
  });

  it("bez zadań i bez wpisów: „—”", () => {
    const t = kafelki();
    t.tasks = { done: 0, total: 0, percent: null, todayDone: 0, todayTotal: 0 };
    t.habits = { percent: null, above70: 0, plannedDays: 0 };
    t.sleep = { avgMin: null, goalMin: 480, nightsAtGoal: 0, nights: 0 };
    wyrenderuj(t);
    for (const nazwa of ["Zadania", "Nawyki", "Śr. sen"]) {
      expect(within(kafelek(nazwa)).getByText(/—/)).toBeInTheDocument();
    }
    expect(
      within(kafelek("Zadania")).getByText("dziś 0/0"),
    ).toBeInTheDocument();
  });

  it("tydzień od niedzieli przez koniec miesiąca: „nd 29.11 – sb 5.12”, dziś = 3. słupek", () => {
    const t = kafelki();
    t.days.tasks = [1, 2, 3, null, null, null, null];
    wyrenderuj(t, { weekStartDate: "2026-11-29", today: "2026-12-01" });
    expect(screen.getByText("nd 29.11 – sb 5.12")).toBeInTheDocument();
    expect(slupki("Zadania")[2][2]).toBe(ZIELONY);
  });

  it("godzina biegu w formacie 12 h", () => {
    wyrenderuj(kafelki(), { clock: "12" });
    expect(
      within(kafelek("Bieg")).getByText("dziś 4:00 PM · 10 km w planie"),
    ).toBeInTheDocument();
  });
});
