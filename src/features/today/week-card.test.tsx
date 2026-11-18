import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { WeekTiles } from "./model";
import { WeekCard } from "./week-card";

// Wartości jak w makiecie Today.dc.html
function kafelki(): WeekTiles {
  return {
    tasks: { done: 18, total: 41, percent: 44, todayDone: 4, todayTotal: 12 },
    habits: { percent: 78, above70: 2, plannedDays: 2 },
    sleep: { avgMin: 444, goalMin: 480, nightsAtGoal: 1, nights: 2 },
    run: {
      km: 0,
      goalKm: 25,
      nextRun: { date: "2026-11-17", startMin: 16 * 60 },
    },
    workouts: { done: 0, total: 4 },
  };
}

function kafelek(etykieta: string) {
  return screen
    .getAllByTestId("kafelek-tygodnia")
    .find((k) => within(k).queryByText(etykieta) !== null)!;
}

function pasek(etykieta: string) {
  return within(kafelek(etykieta)).getByRole("progressbar");
}

describe("WeekCard", () => {
  it("pokazuje zakres tygodnia i pięć kafelków z wartościami, paskami i dopiskami", () => {
    render(
      <WeekCard
        tiles={kafelki()}
        weekStartDate="2026-11-16"
        today="2026-11-17"
        clock="24"
      />,
    );
    expect(
      screen.getByRole("heading", { name: "Ten tydzień" }),
    ).toBeInTheDocument();
    expect(screen.getByText("pn 16 – nd 22.11")).toBeInTheDocument();
    expect(screen.getAllByTestId("kafelek-tygodnia")).toHaveLength(5);

    const zadania = kafelek("Zadania");
    expect(within(zadania).getByText("18/41")).toBeInTheDocument();
    expect(within(zadania).getByText("44% · dziś 4/12")).toBeInTheDocument();
    expect(pasek("Zadania")).toHaveAttribute("aria-valuenow", "44");

    const nawyki = kafelek("Nawyki");
    expect(within(nawyki).getByText("78%")).toBeInTheDocument();
    expect(
      within(nawyki).getByText("2 z 2 dni powyżej 70%"),
    ).toBeInTheDocument();
    expect(pasek("Nawyki")).toHaveAttribute("aria-valuenow", "78");

    const sen = kafelek("Śr. sen");
    expect(within(sen).getByText(/7:24/)).toBeInTheDocument();
    expect(within(sen).getByText("/ 8:00")).toBeInTheDocument();
    expect(within(sen).getByText("1 z 2 nocy ≥ cel")).toBeInTheDocument();
    // 444 / 480 = 92,5% → 93
    expect(pasek("Śr. sen")).toHaveAttribute("aria-valuenow", "93");

    const bieg = kafelek("Bieg");
    expect(within(bieg).getByText(/0,0/)).toBeInTheDocument();
    expect(within(bieg).getByText("/ 25 km")).toBeInTheDocument();
    expect(within(bieg).getByText("dziś 16:00")).toBeInTheDocument();
    expect(pasek("Bieg")).toHaveAttribute("aria-valuenow", "0");

    const treningi = kafelek("Treningi");
    expect(within(treningi).getByText(/^0/)).toBeInTheDocument();
    expect(within(treningi).getByText("/ 4")).toBeInTheDocument();
  });

  it("bez celu km nie pokazuje „/ cel”, a pasek biegu jest pusty", () => {
    const t = kafelki();
    t.run = { km: 12.4, goalKm: null, nextRun: null };
    render(
      <WeekCard
        tiles={t}
        weekStartDate="2026-11-16"
        today="2026-11-17"
        clock="24"
      />,
    );
    const bieg = kafelek("Bieg");
    expect(within(bieg).getByText(/12,4/)).toBeInTheDocument();
    expect(within(bieg).queryByText(/\//)).not.toBeInTheDocument();
    expect(within(bieg).getByText("brak zaplanowanych")).toBeInTheDocument();
    expect(pasek("Bieg")).toHaveAttribute("aria-valuenow", "0");
  });

  it("z celem km pasek = km / cel (maks. 100%), bieg w innym dniu ma skrót dnia", () => {
    const t = kafelki();
    t.run = {
      km: 30,
      goalKm: 25,
      nextRun: { date: "2026-11-19", startMin: 18 * 60 + 30 },
    };
    t.workouts = { done: 3, total: 4 };
    render(
      <WeekCard
        tiles={t}
        weekStartDate="2026-11-16"
        today="2026-11-17"
        clock="24"
      />,
    );
    expect(pasek("Bieg")).toHaveAttribute("aria-valuenow", "100");
    expect(within(kafelek("Bieg")).getByText("cz 18:30")).toBeInTheDocument();
    expect(pasek("Treningi")).toHaveAttribute("aria-valuenow", "75");
  });

  it("bez zadań i bez wpisów: „—” i puste paski", () => {
    const t = kafelki();
    t.tasks = { done: 0, total: 0, percent: null, todayDone: 0, todayTotal: 0 };
    t.habits = { percent: null, above70: 0, plannedDays: 0 };
    t.sleep = { avgMin: null, goalMin: 480, nightsAtGoal: 0, nights: 0 };
    render(
      <WeekCard
        tiles={t}
        weekStartDate="2026-11-16"
        today="2026-11-17"
        clock="24"
      />,
    );
    for (const nazwa of ["Zadania", "Nawyki", "Śr. sen"]) {
      expect(within(kafelek(nazwa)).getByText(/—/)).toBeInTheDocument();
      expect(pasek(nazwa)).toHaveAttribute("aria-valuenow", "0");
    }
  });

  it("tydzień od niedzieli przez koniec miesiąca: „nd 29.11 – sb 5.12”", () => {
    render(
      <WeekCard
        tiles={kafelki()}
        weekStartDate="2026-11-29"
        today="2026-12-01"
        clock="24"
      />,
    );
    expect(screen.getByText("nd 29.11 – sb 5.12")).toBeInTheDocument();
  });

  it("godzina biegu w formacie 12 h", () => {
    render(
      <WeekCard
        tiles={kafelki()}
        weekStartDate="2026-11-16"
        today="2026-11-17"
        clock="12"
      />,
    );
    expect(
      within(kafelek("Bieg")).getByText("dziś 4:00 PM"),
    ).toBeInTheDocument();
  });
});
