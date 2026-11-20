import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createHabit, updateHabit } = vi.hoisted(() => ({
  createHabit: vi.fn(),
  updateHabit: vi.fn(),
}));
vi.mock("./actions", () => ({ createHabit, updateHabit }));

import { HabitDialog } from "./habit-dialog";
import type { Habit } from "./model";

function wyrenderuj(habit?: Habit, weekStart: "mon" | "sun" = "mon") {
  const onOpenChange = vi.fn();
  render(
    <HabitDialog
      open
      onOpenChange={onOpenChange}
      habit={habit}
      weekStart={weekStart}
      clock="24"
      today="2026-11-17"
    />,
  );
  return { onOpenChange };
}

const NAWYK: Habit = {
  id: "h1",
  name: "Rozciąganie",
  remindAt: "20:30",
  showOnToday: false,
  createdAt: "",
  schedules: [
    {
      validFrom: "2026-10-01",
      type: "daily",
      weekdays: [],
      timesPerWeek: null,
    },
    {
      validFrom: "2026-11-01",
      type: "weekdays",
      weekdays: [1, 3, 5],
      timesPerWeek: null,
    },
    // przyszła wersja nie obowiązuje dziś
    {
      validFrom: "2026-12-01",
      type: "times_per_week",
      weekdays: [],
      timesPerWeek: 2,
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

describe("HabitDialog", () => {
  it("„Anuluj” w stopce bez ramki (ghost), na telefonie 44 px", () => {
    wyrenderuj();
    const anuluj = screen.getByRole("button", { name: "Anuluj" });
    expect(anuluj).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(anuluj.className).not.toContain("border-input");
    expect(anuluj).toHaveClass("max-[799px]:h-11");
  });

  it("tryb nowy: tytuł, przycisk i zdanie dla Codziennie", () => {
    wyrenderuj();
    expect(
      screen.getByRole("dialog", { name: "Nowy nawyk" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj nawyk" })).toBeDisabled();
    expect(
      screen.getByText("Codziennie. Seria liczona w dniach."),
    ).toBeInTheDocument();
  });

  it("bez nazwy zapis jest zablokowany, z nazwą — dostępny", async () => {
    const u = userEvent.setup();
    wyrenderuj();
    await u.type(screen.getByLabelText("Nazwa"), "   ");
    expect(screen.getByRole("button", { name: "Dodaj nawyk" })).toBeDisabled();
    await u.type(screen.getByLabelText("Nazwa"), "Woda");
    expect(screen.getByRole("button", { name: "Dodaj nawyk" })).toBeEnabled();
  });

  it("Wybrane dni: zdanie z listą dni, 0 dni blokuje zapis, 7 dni to Codziennie", async () => {
    const u = userEvent.setup();
    wyrenderuj();
    await u.type(screen.getByLabelText("Nazwa"), "Woda");
    await u.click(screen.getByRole("radio", { name: "Wybrane dni" }));
    // zero dni
    expect(screen.getByRole("button", { name: "Dodaj nawyk" })).toBeDisabled();
    await u.click(screen.getByRole("button", { name: "poniedziałek" }));
    await u.click(screen.getByRole("button", { name: "środa" }));
    expect(
      screen.getByText("pn, śr. Pozostałe dni nie psują serii."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj nawyk" })).toBeEnabled();
    for (const d of ["wtorek", "czwartek", "piątek", "sobota", "niedziela"]) {
      await u.click(screen.getByRole("button", { name: d }));
    }
    expect(
      screen.getByText("Wszystkie dni — to to samo co „Codziennie”."),
    ).toBeInTheDocument();
  });

  it("przyciski dni zaczynają od niedzieli przy week_start = sun", async () => {
    const u = userEvent.setup();
    wyrenderuj(undefined, "sun");
    await u.click(screen.getByRole("radio", { name: "Wybrane dni" }));
    const nazwy = screen
      .getAllByRole("button")
      .map((b) => b.getAttribute("aria-label"))
      .filter(
        (n) =>
          n &&
          /^(poniedziałek|wtorek|środa|czwartek|piątek|sobota|niedziela)$/.test(
            n,
          ),
      );
    expect(nazwy).toEqual([
      "niedziela",
      "poniedziałek",
      "wtorek",
      "środa",
      "czwartek",
      "piątek",
      "sobota",
    ]);
  });

  it("X razy w tygodniu: zakres 1–7 i zdanie", async () => {
    const u = userEvent.setup();
    wyrenderuj();
    await u.click(screen.getByRole("radio", { name: "X razy w tygodniu" }));
    expect(
      screen.getByText(
        "3× w tygodniu, dowolne dni. Seria liczona w tygodniach.",
      ),
    ).toBeInTheDocument();
    const mniej = screen.getByRole("button", { name: /Zmniejsz/ });
    const wiecej = screen.getByRole("button", { name: /Zwiększ/ });
    for (let i = 0; i < 5; i++) await u.click(mniej);
    expect(mniej).toBeDisabled();
    expect(
      screen.getByText(
        "1× w tygodniu, dowolne dni. Seria liczona w tygodniach.",
      ),
    ).toBeInTheDocument();
    for (let i = 0; i < 10; i++) await u.click(wiecej);
    expect(wiecej).toBeDisabled();
    expect(
      screen.getByText(
        "7× w tygodniu, dowolne dni. Seria liczona w tygodniach.",
      ),
    ).toBeInTheDocument();
  });

  it("przypomnienie: wyłączony przełącznik blokuje wybór godziny", async () => {
    const u = userEvent.setup();
    wyrenderuj();
    const przelacznik = screen.getByRole("switch", {
      name: "Przypomnienie push",
    });
    const godzina = screen.getByRole("button", {
      name: "Godzina przypomnienia",
    });
    expect(przelacznik).toHaveAttribute("aria-checked", "false");
    expect(godzina).toBeDisabled();
    await u.click(przelacznik);
    expect(godzina).toBeEnabled();
  });

  it("zapis nowego nawyku woła createHabit z dokładnym HabitInput i zamyka okno", async () => {
    const u = userEvent.setup();
    createHabit.mockResolvedValue({ ok: true, id: "n1" });
    const { onOpenChange } = wyrenderuj();
    await u.type(screen.getByLabelText("Nazwa"), "  Rozciąganie ");
    await u.click(screen.getByRole("radio", { name: "Wybrane dni" }));
    await u.click(screen.getByRole("button", { name: "wtorek" }));
    await u.click(screen.getByRole("button", { name: "poniedziałek" }));
    await u.click(screen.getByRole("switch", { name: "Przypomnienie push" }));
    await u.click(screen.getByRole("button", { name: "Dodaj nawyk" }));
    await waitFor(() =>
      expect(createHabit).toHaveBeenCalledWith({
        name: "Rozciąganie",
        schedule: { type: "weekdays", weekdays: [1, 2], timesPerWeek: null },
        remindAt: "20:30",
        showOnToday: true,
      }),
    );
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("bez przypomnienia remindAt = null, a Codziennie nie wysyła dni", async () => {
    const u = userEvent.setup();
    createHabit.mockResolvedValue({ ok: true, id: "n1" });
    wyrenderuj();
    await u.type(screen.getByLabelText("Nazwa"), "Woda");
    await u.click(
      screen.getByRole("switch", { name: "Pokazuj na ekranie Dziś" }),
    );
    await u.click(screen.getByRole("button", { name: "Dodaj nawyk" }));
    await waitFor(() =>
      expect(createHabit).toHaveBeenCalledWith({
        name: "Woda",
        schedule: { type: "daily", weekdays: [], timesPerWeek: null },
        remindAt: null,
        showOnToday: false,
      }),
    );
  });

  it("błąd zostawia okno otwarte z komunikatem, w trakcie zapisu Anuluj jest zablokowany", async () => {
    const u = userEvent.setup();
    let zakoncz!: (v: { ok: false; message: string }) => void;
    createHabit.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const { onOpenChange } = wyrenderuj();
    await u.type(screen.getByLabelText("Nazwa"), "Woda");
    await u.click(screen.getByRole("button", { name: "Dodaj nawyk" }));
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await u.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
    zakoncz({ ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." });
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeEnabled();
  });

  it("tryb edycji: tytuł, przycisk i wartości z obowiązującej dziś wersji", async () => {
    const u = userEvent.setup();
    updateHabit.mockResolvedValue({ ok: true });
    wyrenderuj(NAWYK);
    expect(
      screen.getByRole("dialog", { name: "Edytuj nawyk" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa")).toHaveValue("Rozciąganie");
    expect(screen.getByRole("radio", { name: "Wybrane dni" })).toBeChecked();
    expect(
      screen.getByRole("button", { name: "poniedziałek" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "wtorek" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(
      screen.getByRole("switch", { name: "Przypomnienie push" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(
      screen.getByRole("switch", { name: "Pokazuj na ekranie Dziś" }),
    ).toHaveAttribute("aria-checked", "false");
    await u.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() =>
      expect(updateHabit).toHaveBeenCalledWith("h1", {
        name: "Rozciąganie",
        schedule: { type: "weekdays", weekdays: [1, 3, 5], timesPerWeek: null },
        remindAt: "20:30",
        showOnToday: false,
      }),
    );
  });

  it("tryb edycji bez przypomnienia: przełącznik wyłączony, remindAt = null, bez createHabit", async () => {
    const u = userEvent.setup();
    updateHabit.mockResolvedValue({ ok: true });
    wyrenderuj({ ...NAWYK, remindAt: null });
    expect(
      screen.getByRole("switch", { name: "Przypomnienie push" }),
    ).toHaveAttribute("aria-checked", "false");
    expect(
      screen.getByRole("button", { name: "Godzina przypomnienia" }),
    ).toBeDisabled();
    await u.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() =>
      expect(updateHabit).toHaveBeenCalledWith(
        "h1",
        expect.objectContaining({ remindAt: null }),
      ),
    );
    expect(createHabit).not.toHaveBeenCalled();
  });

  it("ponowne otwarcie dla innego nawyku pokazuje jego wartości", () => {
    const inny: Habit = {
      id: "h2",
      name: "Czytanie",
      remindAt: null,
      showOnToday: true,
      createdAt: "",
      schedules: [
        {
          validFrom: "2026-11-01",
          type: "times_per_week",
          weekdays: [],
          timesPerWeek: 5,
        },
      ],
    };
    const props = {
      onOpenChange: vi.fn(),
      weekStart: "mon" as const,
      clock: "24" as const,
      today: "2026-11-17" as const,
    };
    const { rerender } = render(<HabitDialog open habit={NAWYK} {...props} />);
    expect(screen.getByLabelText("Nazwa")).toHaveValue("Rozciąganie");
    rerender(<HabitDialog open={false} habit={NAWYK} {...props} />);
    rerender(<HabitDialog open habit={inny} {...props} />);
    expect(screen.getByLabelText("Nazwa")).toHaveValue("Czytanie");
    expect(
      screen.getByRole("radio", { name: "X razy w tygodniu" }),
    ).toBeChecked();
    expect(
      screen.getByText(
        "5× w tygodniu, dowolne dni. Seria liczona w tygodniach.",
      ),
    ).toBeInTheDocument();
  });
});
