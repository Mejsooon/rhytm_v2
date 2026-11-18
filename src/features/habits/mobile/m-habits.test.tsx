import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { IsoDate } from "@/components/controls/calendar-math";
import type { HabitsPageData } from "../load-habits";
import type { Checks } from "../model";
import { MHabits } from "./m-habits";

// Wtorek 17.11.2026, tydzień od poniedziałku
function dane(): HabitsPageData {
  return {
    today: "2026-11-17",
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 450,
    habits: [
      {
        id: "h1",
        name: "Woda 2 l",
        remindAt: null,
        showOnToday: true,
        createdAt: "",
        schedules: [{ validFrom: "2026-11-01", type: "daily", weekdays: [], timesPerWeek: null }],
      },
      {
        id: "h2",
        name: "Rozciąganie",
        remindAt: null,
        showOnToday: true,
        createdAt: "",
        schedules: [{ validFrom: "2026-11-01", type: "weekdays", weekdays: [1, 3, 5], timesPerWeek: null }],
      },
      {
        id: "h3",
        name: "Angielski",
        remindAt: null,
        showOnToday: true,
        createdAt: "",
        schedules: [{ validFrom: "2026-11-01", type: "times_per_week", weekdays: [], timesPerWeek: 4 }],
      },
    ],
    checks: [],
    sleepLogs: [
      { date: "2026-11-16", sleptAt: "22:30", wokeAt: "06:30", feeling: 3, tags: [], note: null },
      { date: "2026-11-17", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: [], note: null },
    ],
  };
}

// Woda: 13–17.11 (seria 5 dni); Angielski: dziś
function odhaczenia(): Checks {
  return new Map([
    ["h1", new Set<IsoDate>(["2026-11-13", "2026-11-14", "2026-11-15", "2026-11-16", "2026-11-17"])],
    ["h3", new Set<IsoDate>(["2026-11-17"])],
  ]);
}

function wyrenderuj(opcje: { initialTab?: "sen" | null; checks?: Checks; data?: HabitsPageData } = {}) {
  const onToggle = vi.fn();
  const onNewHabit = vi.fn();
  const onNewSleep = vi.fn();
  render(
    <MHabits
      data={opcje.data ?? dane()}
      checks={opcje.checks ?? odhaczenia()}
      initialTab={opcje.initialTab ?? null}
      onToggle={onToggle}
      onNewHabit={onNewHabit}
      onNewSleep={onNewSleep}
    />,
  );
  return { onToggle, onNewHabit, onNewSleep };
}

describe("MHabits — zakładka Nawyki", () => {
  it("nagłówek z datą, tytułem i „+” nowego nawyku", async () => {
    const { onNewHabit } = wyrenderuj();
    expect(screen.getByText("Wtorek · 17 listopada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1, name: "Nawyki i sen" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Nowy nawyk" }));
    expect(onNewHabit).toHaveBeenCalled();
  });

  it("segment Nawyki / Sen, domyślnie Nawyki", () => {
    wyrenderuj();
    const segment = screen.getByRole("radiogroup", { name: "Widok" });
    expect(within(segment).getByRole("radio", { name: "Nawyki" })).toHaveAttribute("aria-checked", "true");
    expect(within(segment).getByRole("radio", { name: "Sen" })).toHaveAttribute("aria-checked", "false");
  });

  it("pierścień „x z y zrobione dziś” z dayStats (X/tydz. liczy się po odhaczeniu)", () => {
    wyrenderuj();
    // Wtorek: Woda zaplanowana i zrobiona, Rozciąganie niezaplanowane, Angielski odhaczony → 2 z 2
    expect(screen.getByText("2 z 2 zrobione dziś")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "2 z 2 nawyków" })).toBeInTheDocument();
  });

  it("„Najdłuższa seria: {nazwa} · N dni”", () => {
    wyrenderuj();
    expect(screen.getByText("Najdłuższa seria: Woda 2 l · 5 dni")).toBeInTheDocument();
  });

  it("lista: duży checkbox ≥ 44 px, harmonogram i seria, nazwa prowadzi do szczegółów", () => {
    wyrenderuj();
    const woda = screen.getByRole("checkbox", { name: "Woda 2 l" });
    expect(woda).toHaveAttribute("aria-checked", "true");
    // Pole stuknięcia 44 px (kwadrat 28 px + pseudo-element)
    expect(woda.className).toContain("after:-inset-2");
    expect(screen.getByText("Codziennie · seria 5 dni")).toBeInTheDocument();
    expect(screen.getByText("Pn, Śr, Pt · seria 0 dni")).toBeInTheDocument();
    expect(screen.getByText("4× w tygodniu · seria 0 tyg.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Woda 2 l/ })).toHaveAttribute("href", "/nawyki/h1");
  });

  it("stuknięcie checkboxa odhacza dziś; X/tydz. też ma dzisiejsze odhaczenie", async () => {
    const { onToggle } = wyrenderuj();
    expect(screen.getByRole("checkbox", { name: "Angielski" })).toHaveAttribute("aria-checked", "true");
    await userEvent.click(screen.getByRole("checkbox", { name: "Woda 2 l" }));
    expect(onToggle).toHaveBeenCalledWith("h1", "2026-11-17");
  });

  it("nawyk niezaplanowany na dziś ma wyłączony checkbox", async () => {
    const { onToggle } = wyrenderuj();
    const rozciaganie = screen.getByRole("checkbox", { name: "Rozciąganie" });
    expect(rozciaganie).toBeDisabled();
    await userEvent.click(rozciaganie);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("heatmapa 4 tygodni: podpowiedź, stuknięcie pokazuje „{data} · x z y nawyków”", async () => {
    wyrenderuj();
    expect(screen.getByRole("heading", { name: "Ostatnie 4 tygodnie" })).toBeInTheDocument();
    expect(screen.getByText("stuknij dzień")).toBeInTheDocument();
    // 4 tygodnie po 7 dni
    expect(document.querySelectorAll("[data-heat-day]")).toHaveLength(28);
    await userEvent.click(screen.getByRole("button", { name: "16.11.2026 · 1 z 2 nawyków" }));
    expect(screen.getByText("16.11.2026 · 1 z 2 nawyków")).toBeInTheDocument();
    expect(screen.getByText("mniej")).toBeInTheDocument();
    expect(screen.getByText("więcej")).toBeInTheDocument();
  });

  it("dzień bez planu: „· brak zaplanowanych”", async () => {
    wyrenderuj();
    // 26.10 — przed startem nawyków
    await userEvent.click(screen.getByRole("button", { name: "26.10.2026 · brak zaplanowanych" }));
    expect(screen.getByText("26.10.2026 · brak zaplanowanych")).toBeInTheDocument();
  });

  it("heatmapa: dzień bez planu ma przerywaną ramkę i inne tło niż 0%", () => {
    wyrenderuj();
    // 26.10 — przed startem nawyków (bez planu); pn 02.11 — Woda i Rozciąganie zaplanowane, nic nie odhaczone (0%)
    const bezPlanu = screen.getByRole("button", { name: "26.10.2026 · brak zaplanowanych" });
    const zero = screen.getByRole("button", { name: "02.11.2026 · 0 z 2 nawyków" });
    expect(bezPlanu.style.background).toBe("rgb(250, 250, 250)");
    expect(bezPlanu.className).toContain("border-dashed");
    expect(bezPlanu.className).toContain("border-[#d4d4d4]");
    expect(zero.style.background).toBe("rgb(240, 240, 240)");
    expect(zero.className).not.toContain("border-dashed");
  });

  it("bez nawyków: stan pusty z przyciskiem dodania", async () => {
    const d = dane();
    d.habits = [];
    const { onNewHabit } = wyrenderuj({ data: d, checks: new Map() });
    expect(screen.getByText("Nie masz jeszcze nawyków.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Dodaj pierwszy nawyk" }));
    expect(onNewHabit).toHaveBeenCalled();
  });
});

describe("MHabits — zakładka Sen", () => {
  it("?tab=sen startuje na zakładce Sen", () => {
    wyrenderuj({ initialTab: "sen" });
    expect(screen.getByRole("radio", { name: "Sen" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByText("Ostatnie 4 tygodnie")).not.toBeInTheDocument();
  });

  it("Ostatnia noc: czas, godziny i samopoczucie; Średnio 14 dni i cel", async () => {
    wyrenderuj();
    await userEvent.click(screen.getByRole("radio", { name: "Sen" }));
    const ostatnia = screen.getByRole("button", { name: /Ostatnia noc/ });
    expect(ostatnia).toHaveTextContent("7:12");
    expect(ostatnia).toHaveTextContent("23:48 → 07:00 · Dobrze");
    expect(screen.getByText("Średnio 14 dni")).toBeInTheDocument();
    // (7:12 + 8:00) / 2 = 7:36
    expect(screen.getByText("7:36")).toBeInTheDocument();
    expect(screen.getByText("cel 7:30")).toBeInTheDocument();
  });

  it("stuknięcie „Ostatniej nocy” otwiera jej wpis", async () => {
    const { onNewSleep } = wyrenderuj({ initialTab: "sen" });
    await userEvent.click(screen.getByRole("button", { name: /Ostatnia noc/ }));
    expect(onNewSleep).toHaveBeenCalledWith("2026-11-17");
  });

  it("wykres 14/30: podpowiedź, stuknięcie słupka pokazuje szczegóły", async () => {
    wyrenderuj({ initialTab: "sen" });
    expect(screen.getByText("Stuknij słupek, żeby zobaczyć szczegóły")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-sleep-bar]")).toHaveLength(14);
    await userEvent.click(screen.getByRole("button", { name: "16.11 · 8:00 h" }));
    expect(screen.getByText("16.11 · 8:00 h")).toBeInTheDocument();
    expect(screen.queryByText("Stuknij słupek, żeby zobaczyć szczegóły")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("radio", { name: "30 dni" }));
    expect(document.querySelectorAll("[data-sleep-bar]")).toHaveLength(30);
    expect(screen.getByText("Średnio 30 dni")).toBeInTheDocument();
    // Zmiana zakresu czyści wybór
    expect(screen.getByText("Stuknij słupek, żeby zobaczyć szczegóły")).toBeInTheDocument();
  });

  it("słupek bez wpisu: „brak wpisu”", async () => {
    wyrenderuj({ initialTab: "sen" });
    await userEvent.click(screen.getByRole("button", { name: "10.11 · brak wpisu" }));
    expect(screen.getByText("10.11 · brak wpisu")).toBeInTheDocument();
  });

  it("„Dodaj wpis snu” otwiera arkusz na dziś", async () => {
    const { onNewSleep } = wyrenderuj({ initialTab: "sen" });
    await userEvent.click(screen.getByRole("button", { name: "Dodaj wpis snu" }));
    expect(onNewSleep).toHaveBeenCalledWith("2026-11-17");
  });

  it("bez wpisów: kreski zamiast liczb", () => {
    const d = dane();
    d.sleepLogs = [];
    wyrenderuj({ data: d, initialTab: "sen" });
    expect(screen.getByText("brak wpisów")).toBeInTheDocument();
    expect(screen.getAllByText("—")).toHaveLength(2);
  });
});
