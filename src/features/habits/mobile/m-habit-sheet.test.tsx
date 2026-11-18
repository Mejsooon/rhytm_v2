import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createHabit, updateHabit } = vi.hoisted(() => ({
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
}));
vi.mock("../actions", () => ({ createHabit, updateHabit }));

import type { Habit } from "../model";
import { MHabitSheet } from "./m-habit-sheet";

const NAWYK: Habit = {
  id: "h1",
  name: "Rozciąganie",
  remindAt: "21:00",
  showOnToday: false,
  createdAt: "",
  schedules: [
    {
      validFrom: "2026-11-01",
      type: "weekdays",
      weekdays: [1, 3, 5],
      timesPerWeek: null,
    },
  ],
};

function wyrenderuj(
  opcje: { habit?: Habit; weekStart?: "mon" | "sun"; clock?: "24" | "12" } = {},
) {
  const onDone = vi.fn();
  render(
    <MHabitSheet
      habit={opcje.habit}
      weekStart={opcje.weekStart ?? "mon"}
      clock={opcje.clock ?? "24"}
      today="2026-11-17"
      onDone={onDone}
    />,
  );
  return {
    onDone,
    okno: screen.getByRole("dialog", {
      name: opcje.habit ? "Edytuj nawyk" : "Nowy nawyk",
    }),
  };
}

beforeEach(() => vi.clearAllMocks());

describe("MHabitSheet", () => {
  it("nagłówek Anuluj / Nowy nawyk / Zapisz; Zapisz nieaktywne bez nazwy", async () => {
    const { okno, onDone } = wyrenderuj();
    const zapisz = within(okno).getByRole("button", { name: "Zapisz" });
    expect(zapisz).toBeDisabled();
    await userEvent.type(
      within(okno).getByRole("textbox", { name: "Nazwa" }),
      "Medytacja",
    );
    expect(zapisz).toBeEnabled();
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(onDone).toHaveBeenCalled();
  });

  it("segment Codziennie / Wybrane dni / X w tyg. i zdanie podsumowania", async () => {
    const { okno } = wyrenderuj();
    const segment = within(okno).getByRole("radiogroup", {
      name: "Jak często",
    });
    expect(
      within(segment)
        .getAllByRole("radio")
        .map((r) => r.textContent),
    ).toEqual(["Codziennie", "Wybrane dni", "X w tyg."]);
    expect(
      within(okno).getByText("Nawyk: codziennie, bez przypomnienia."),
    ).toBeInTheDocument();
  });

  it("Wybrane dni: przyciski od pierwszego dnia tygodnia, bez dni Zapisz nieaktywne", async () => {
    const { okno } = wyrenderuj({ weekStart: "sun" });
    await userEvent.type(
      within(okno).getByRole("textbox", { name: "Nazwa" }),
      "Bieg",
    );
    await userEvent.click(
      within(okno).getByRole("radio", { name: "Wybrane dni" }),
    );
    const dni = within(
      within(okno).getByRole("group", { name: "Dni tygodnia" }),
    ).getAllByRole("button");
    expect(dni.map((d) => d.textContent)).toEqual([
      "Nd",
      "Pn",
      "Wt",
      "Śr",
      "Cz",
      "Pt",
      "Sb",
    ]);
    expect(
      within(okno).getByText("Nawyk: brak dni, bez przypomnienia."),
    ).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeDisabled();
    await userEvent.click(within(okno).getByRole("button", { name: "piątek" }));
    await userEvent.click(
      within(okno).getByRole("button", { name: "poniedziałek" }),
    );
    expect(
      within(okno).getByText("Nawyk: Pn, Pt, bez przypomnienia."),
    ).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeEnabled();
  });

  it("X w tyg.: Stepper „Razy w tygodniu” 1–7", async () => {
    const { okno } = wyrenderuj();
    await userEvent.click(
      within(okno).getByRole("radio", { name: "X w tyg." }),
    );
    const stepper = within(okno).getByRole("group", {
      name: "Razy w tygodniu",
    });
    expect(stepper).toHaveTextContent("3");
    const plus = within(okno).getByRole("button", {
      name: "Zwiększ Razy w tygodniu",
    });
    for (let i = 0; i < 6; i++) await userEvent.click(plus);
    expect(stepper).toHaveTextContent("7");
    expect(plus).toBeDisabled();
    expect(
      within(okno).getByText("Nawyk: 7× w tygodniu, bez przypomnienia."),
    ).toBeInTheDocument();
  });

  it("przypomnienie: chipy godzin i „Inna…” z wyborem godziny", async () => {
    const { okno } = wyrenderuj();
    await userEvent.click(
      within(okno).getByRole("switch", { name: "Przypomnienie" }),
    );
    const chipy = ["07:30", "12:00", "18:00", "21:00", "Inna…"];
    for (const c of chipy)
      expect(within(okno).getByRole("button", { name: c })).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "07:30" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(within(okno).getByRole("button", { name: "18:00" }));
    expect(
      within(okno).getByText("Nawyk: codziennie, przypomnienie o 18:00."),
    ).toBeInTheDocument();
    expect(
      within(okno).queryByRole("button", { name: "Godzina przypomnienia" }),
    ).not.toBeInTheDocument();
    await userEvent.click(within(okno).getByRole("button", { name: "Inna…" }));
    expect(within(okno).getByRole("button", { name: "Inna…" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(okno).getByRole("button", { name: "Godzina przypomnienia" }),
    ).toHaveTextContent("18:00");
  });

  it("przełącznik „Pokazuj na ekranie Dziś” (domyślnie włączony)", () => {
    const { okno } = wyrenderuj();
    expect(
      within(okno).getByRole("switch", { name: "Pokazuj na ekranie Dziś" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("zapis nowego nawyku: ten sam ładunek co web, sukces zamyka arkusz", async () => {
    createHabit.mockResolvedValue({ ok: true });
    const { okno, onDone } = wyrenderuj();
    await userEvent.type(
      within(okno).getByRole("textbox", { name: "Nazwa" }),
      "  Bieg  ",
    );
    await userEvent.click(
      within(okno).getByRole("radio", { name: "Wybrane dni" }),
    );
    await userEvent.click(within(okno).getByRole("button", { name: "piątek" }));
    await userEvent.click(
      within(okno).getByRole("button", { name: "poniedziałek" }),
    );
    await userEvent.click(
      within(okno).getByRole("switch", { name: "Przypomnienie" }),
    );
    await userEvent.click(within(okno).getByRole("button", { name: "21:00" }));
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(createHabit).toHaveBeenCalledWith({
      name: "Bieg",
      schedule: { type: "weekdays", weekdays: [1, 5], timesPerWeek: null },
      remindAt: "21:00",
      showOnToday: true,
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("w trakcie zapisu Anuluj i Esc są zablokowane; błąd zostaje w arkuszu", async () => {
    let zakoncz!: (v: { ok: false; message: string }) => void;
    createHabit.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const { okno, onDone } = wyrenderuj();
    await userEvent.type(
      within(okno).getByRole("textbox", { name: "Nazwa" }),
      "Bieg",
    );
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(within(okno).getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onDone).not.toHaveBeenCalled();
    await act(async () =>
      zakoncz({
        ok: false,
        message: "Nie udało się zapisać. Spróbuj ponownie.",
      }),
    );
    expect(within(okno).getByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(within(okno).getByRole("button", { name: "Anuluj" })).toBeEnabled();
  });

  it("edycja: wartości nawyku, tytuł „Edytuj nawyk”, zapis przez updateHabit", async () => {
    updateHabit.mockResolvedValue({ ok: true });
    const { okno } = wyrenderuj({ habit: NAWYK });
    expect(within(okno).getByRole("textbox", { name: "Nazwa" })).toHaveValue(
      "Rozciąganie",
    );
    expect(
      within(okno).getByRole("radio", { name: "Wybrane dni" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(within(okno).getByRole("button", { name: "21:00" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(okno).getByText("Nawyk: Pn, Śr, Pt, przypomnienie o 21:00."),
    ).toBeInTheDocument();
    expect(
      within(okno).getByRole("switch", { name: "Pokazuj na ekranie Dziś" }),
    ).toHaveAttribute("aria-checked", "false");
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(updateHabit).toHaveBeenCalledWith("h1", {
      name: "Rozciąganie",
      schedule: { type: "weekdays", weekdays: [1, 3, 5], timesPerWeek: null },
      remindAt: "21:00",
      showOnToday: false,
    });
  });

  it("edycja z godziną spoza chipów: „Inna…” wybrane i widoczny wybór godziny", () => {
    const { okno } = wyrenderuj({ habit: { ...NAWYK, remindAt: "20:15" } });
    expect(within(okno).getByRole("button", { name: "Inna…" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(
      within(okno).getByRole("button", { name: "Godzina przypomnienia" }),
    ).toHaveTextContent("20:15");
  });

  it("zegar 12 h w chipach i podsumowaniu", async () => {
    const { okno } = wyrenderuj({ clock: "12" });
    await userEvent.click(
      within(okno).getByRole("switch", { name: "Przypomnienie" }),
    );
    expect(
      within(okno).getByRole("button", { name: "7:30 AM" }),
    ).toBeInTheDocument();
    expect(
      within(okno).getByText("Nawyk: codziennie, przypomnienie o 7:30 AM."),
    ).toBeInTheDocument();
  });
});
