import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { TodayHabit } from "./model";
import { TodayHabits } from "./today-habits";

const NAWYKI: TodayHabit[] = [
  {
    id: "h1",
    name: "Woda 2 l",
    done: true,
    streak: { value: 6, unit: "days" },
    streakLabel: "6 dni z rzędu",
    hot: true,
  },
  {
    id: "h2",
    name: "Rozciąganie",
    done: false,
    streak: { value: 0, unit: "days" },
    streakLabel: "zacznij passę",
    hot: false,
  },
  {
    id: "h3",
    name: "Bez telefonu po 23",
    done: false,
    streak: { value: 2, unit: "weeks" },
    streakLabel: "2 tyg. z rzędu",
    hot: false,
  },
];

describe("TodayHabits", () => {
  it("kafelki aria-pressed z nazwą i passą; licznik „odhaczone / wszystkie”", () => {
    render(
      <TodayHabits habits={NAWYKI} onToggle={vi.fn()} onCreate={vi.fn()} />,
    );
    const sekcja = screen.getByRole("region", { name: "Nawyki na dziś" });
    expect(within(sekcja).getByTestId("licznik-nawykow")).toHaveTextContent(
      "1 / 3",
    );
    const woda = screen.getByRole("button", { name: /Woda 2 l/ });
    expect(woda).toHaveAttribute("aria-pressed", "true");
    expect(woda).toHaveTextContent("6 dni z rzędu");
    expect(
      screen.getByRole("button", { name: /Rozciąganie/ }),
    ).toHaveAttribute("aria-pressed", "false");
  });

  it("płomień przy passie ≥ 1; od 3 kolor #c2410c, „zacznij passę” bez ikony", () => {
    render(
      <TodayHabits habits={NAWYKI} onToggle={vi.fn()} onCreate={vi.fn()} />,
    );
    const passa = (nazwa: RegExp) =>
      within(screen.getByRole("button", { name: nazwa })).getByText(
        /z rzędu|zacznij/,
      );
    expect(passa(/Woda/)).toHaveClass("text-[#c2410c]");
    expect(passa(/Woda/).querySelector("svg")).not.toBeNull();
    expect(passa(/Bez telefonu/)).toHaveClass("text-muted-foreground");
    expect(passa(/Bez telefonu/).querySelector("svg")).not.toBeNull();
    expect(passa(/Rozciąganie/).querySelector("svg")).toBeNull();
  });

  it("klik w kafelek odhacza nawyk", async () => {
    const onToggle = vi.fn();
    render(
      <TodayHabits habits={NAWYKI} onToggle={onToggle} onCreate={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: /Rozciąganie/ }));
    expect(onToggle).toHaveBeenCalledWith("h2");
  });

  it("bez nawyków na dziś: kafelek „Utwórz nowy nawyk”, bez licznika", async () => {
    const onCreate = vi.fn();
    render(<TodayHabits habits={[]} onToggle={vi.fn()} onCreate={onCreate} />);
    expect(screen.queryByTestId("licznik-nawykow")).not.toBeInTheDocument();
    const nowy = screen.getByRole("button", { name: "Utwórz nowy nawyk" });
    expect(nowy).toHaveClass("border-dashed");
    await userEvent.click(nowy);
    expect(onCreate).toHaveBeenCalled();
  });
});
