import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { addDays } from "@/features/calendar/view-range";
import { HabitTiles } from "./habit-tiles";
import type { Checks, Habit } from "./model";
import type { SleepLog } from "./sleep";

const DZIS = "2026-11-17"; // wtorek

// Woda: codziennie od dziś−42; odhaczona przez ostatnie 30 dni i 12 z 13 dni wcześniej.
// Rozciąganie: wtorki od dziś, nieodhaczone → dziś 1/2, a 30 dni: 98% vs 92% → +6 pkt
function nawyki(): Habit[] {
  return [
    {
      id: "h1",
      name: "Woda 2 l",
      remindAt: null,
      showOnToday: true,
      createdAt: "",
      schedules: [{ validFrom: addDays(DZIS, -42), type: "daily", weekdays: [], timesPerWeek: null }],
    },
    {
      id: "h2",
      name: "Rozciąganie",
      remindAt: null,
      showOnToday: true,
      createdAt: "",
      schedules: [{ validFrom: DZIS, type: "weekdays", weekdays: [2], timesPerWeek: null }],
    },
  ];
}

function odhaczenia(): Checks {
  const dni = new Set<string>();
  for (let i = 0; i <= 42; i++) {
    if (i === 35) continue; // jedna dziura w poprzednim oknie
    dni.add(addDays(DZIS, -i));
  }
  return new Map([["h1", dni]]);
}

const sen: SleepLog[] = [
  { date: "2026-11-17", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: [], note: null },
  { date: "2026-11-16", sleptAt: "23:00", wokeAt: "07:30", feeling: null, tags: [], note: null },
  { date: "2026-11-15", sleptAt: "22:30", wokeAt: "07:00", feeling: null, tags: [], note: null },
];

describe("HabitTiles", () => {
  it("pokazuje cztery kafelki z danymi", () => {
    render(
      <HabitTiles
        habits={nawyki()}
        checks={odhaczenia()}
        today={DZIS}
        weekStart="mon"
        sleepLogs={sen}
        sleepGoalMin={480}
      />,
    );
    expect(screen.getByText("Nawyki dziś")).toBeInTheDocument();
    expect(screen.getByText("1/2")).toBeInTheDocument();
    expect(screen.getByText("98%")).toBeInTheDocument();
    expect(screen.getByText("+6 pkt vs poprzednie 30")).toBeInTheDocument();
    // Woda: 35 dni z rzędu (dziś−34 … dziś)
    expect(screen.getByText("35")).toBeInTheDocument();
    expect(screen.getByText("Woda 2 l")).toBeInTheDocument();
    // (432 + 510 + 510) / 3 = 484 min
    expect(screen.getByText("8:04")).toBeInTheDocument();
    expect(screen.getByText("/ 8:00")).toBeInTheDocument();
    expect(screen.getByText("2 z 14 nocy ≥ cel")).toBeInTheDocument();
  });

  it("bez historii nie pokazuje różnicy, a bez snu pokazuje „—”", () => {
    // nawyk młodszy niż 30 dni: poprzednie okno nie ma dni z planem
    const mlody: Habit[] = [
      { ...nawyki()[0], schedules: [{ validFrom: addDays(DZIS, -10), type: "daily", weekdays: [], timesPerWeek: null }] },
    ];
    render(
      <HabitTiles
        habits={mlody}
        checks={new Map()}
        today={DZIS}
        weekStart="mon"
        sleepLogs={[]}
        sleepGoalMin={480}
      />,
    );
    expect(screen.queryByText(/pkt vs poprzednie 30/)).not.toBeInTheDocument();
    expect(screen.queryByText(/nocy ≥ cel/)).not.toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("przy remisie serii wybiera nawyk pierwszy alfabetycznie", () => {
    const [woda] = nawyki();
    const zero: Habit[] = [
      { ...woda, id: "a", name: "Zumba" },
      { ...woda, id: "b", name: "Angielski" },
    ];
    render(
      <HabitTiles habits={zero} checks={new Map()} today={DZIS} weekStart="mon" sleepLogs={[]} sleepGoalMin={480} />,
    );
    expect(screen.getByText("Angielski")).toBeInTheDocument();
    expect(screen.queryByText("Zumba")).not.toBeInTheDocument();
  });
});
