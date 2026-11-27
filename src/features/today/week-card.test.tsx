import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { WeekBar } from "./model";
import { WeekCard } from "./week-card";

// Wartości z makiety S2Today
const PASKI: WeekBar[] = [
  {
    label: "Treningi",
    value: "2",
    unit: "/ 4",
    percent: 50,
    right: "jeszcze 2",
    delta: null,
  },
  {
    label: "Bieg",
    value: "10",
    unit: "/ 25 km",
    percent: 40,
    right: "jeszcze 15 km",
    delta: null,
  },
  {
    label: "Nawyki",
    value: "78 %",
    unit: "dni z celem",
    percent: 78,
    right: "—",
    delta: null,
  },
  {
    label: "Sen",
    value: "7:25",
    unit: "/ 8:00 śr.",
    percent: 93,
    right: "1 z 2 nocy ≥ cel",
    delta: null,
  },
];

describe("WeekCard", () => {
  it("nagłówek „Ten tydzień” z zakresem i cztery wiersze w jednej karcie jak w makiecie", () => {
    render(<WeekCard bars={PASKI} weekStartDate="2026-11-16" />);
    const sekcja = screen.getByRole("region", { name: "Ten tydzień" });
    expect(within(sekcja).getByText("pn 16 – nd 22.11 · porównanie z tyg. 46")).toBeInTheDocument();
    const wiersze = within(sekcja).getAllByTestId("wiersz-tygodnia");
    expect(wiersze.map((w) => w.textContent)).toEqual([
      "Treningi2 / 4jeszcze 2",
      "Bieg10 / 25 kmjeszcze 15 km",
      "Nawyki78 % dni z celem—",
      "Sen7:25 / 8:00 śr.1 z 2 nocy ≥ cel",
    ]);
    // Jedna karta: wszystkie wiersze mają tego samego rodzica
    expect(new Set(wiersze.map((w) => w.parentElement)).size).toBe(1);
    // Siatka 110 / pasek / 150 / 150 / 110
    expect(wiersze[0]).toHaveClass(
      "grid-cols-[110px_minmax(0,1fr)_150px_150px_110px]",
    );
  });

  it("pasek ma szerokość procentu i wartość progressbar", () => {
    render(<WeekCard bars={PASKI} weekStartDate="2026-11-16" />);
    const bieg = screen.getByRole("progressbar", { name: "Bieg" });
    expect(bieg).toHaveAttribute("aria-valuenow", "40");
    expect(bieg.firstElementChild).toHaveStyle({ width: "40%" });
  });

  it("pusta jednostka (cel wyłączony) nie zostawia dopisku", () => {
    render(
      <WeekCard
        bars={[{ ...PASKI[0], unit: "", percent: 0, right: "—" }]}
        weekStartDate="2026-11-16"
      />,
    );
    expect(screen.getByTestId("wiersz-tygodnia").textContent).toBe(
      "Treningi2—",
    );
  });

  it("tydzień przez koniec miesiąca: „nd 29.11 – sb 5.12”", () => {
    render(<WeekCard bars={PASKI} weekStartDate="2026-11-29" />);
    expect(screen.getByText(/nd 29.11 – sb 5.12/)).toBeInTheDocument();
  });

  it("zmiana wobec poprzedniego tygodnia jest plakietką, a prawa kolumna webu wygrywa", () => {
    render(
      <WeekCard
        bars={[{ ...PASKI[2], webRight: "2 z 4 dziś", delta: { text: "+6 pkt vs tydz. 46", dir: "up" } }]}
        weekStartDate="2026-11-16"
      />,
    );
    expect(screen.getByTestId("wiersz-tygodnia").textContent).toBe(
      "Nawyki78 % dni z celem+6 pkt vs tydz. 462 z 4 dziś",
    );
  });
});
