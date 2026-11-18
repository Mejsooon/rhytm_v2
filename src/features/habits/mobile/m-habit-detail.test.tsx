import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, deleteHabit, addHabitNote, updateHabit, createHabit } =
  vi.hoisted(() => ({
    push: vi.fn(),
    deleteHabit: vi.fn(),
    addHabitNote: vi.fn(),
    updateHabit: vi.fn(),
    createHabit: vi.fn(),
  }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: vi.fn() }),
}));
vi.mock("../actions", () => ({
  deleteHabit,
  addHabitNote,
  updateHabit,
  createHabit,
}));

import type { HabitDetailData } from "../load-habits";
import { MHabitDetail } from "./m-habit-detail";

function dane(): HabitDetailData {
  return {
    today: "2026-11-17", // wtorek
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 480,
    habits: [
      {
        id: "h1",
        name: "Woda 2 l",
        remindAt: "20:00",
        showOnToday: true,
        createdAt: "",
        schedules: [
          {
            validFrom: "2026-03-01",
            type: "daily",
            weekdays: [],
            timesPerWeek: null,
          },
        ],
      },
    ],
    // Listopad: 1–17, bez 4 i 10 → 15 zrobione, 2 pominięte (dziś zrobione)
    checks: Array.from(
      { length: 17 },
      (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`,
    )
      .filter((d) => d !== "2026-11-04" && d !== "2026-11-10")
      .map((date) => ({
        habitId: "h1",
        date: date as `${number}-${number}-${number}`,
      })),
    sleepLogs: [],
    notes: [
      { id: "n1", date: "2026-11-12", text: "Butelka 1 l na biurku pomaga." },
    ],
  };
}

beforeEach(() => vi.clearAllMocks());

describe("MHabitDetail", () => {
  it("nagłówek: wstecz do /nawyki, podtytuł z harmonogramem i przypomnieniem, nazwa", () => {
    render(<MHabitDetail data={dane()} />);
    expect(screen.getByRole("link", { name: "Wstecz" })).toHaveAttribute(
      "href",
      "/nawyki",
    );
    expect(
      screen.getByText("Codziennie · 20:00 przypomnienie"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: "Woda 2 l" }),
    ).toBeInTheDocument();
  });

  it("bez przypomnienia podtytuł to sam harmonogram", () => {
    const d = dane();
    d.habits[0].remindAt = null;
    render(<MHabitDetail data={d} />);
    expect(screen.getByText("Codziennie")).toBeInTheDocument();
  });

  it("kafelki Seria / Rekord / Skuteczn.", () => {
    render(<MHabitDetail data={dane()} />);
    const kafelek = (nazwa: string) =>
      screen.getByText(nazwa).parentElement as HTMLElement;
    // Seria od 11.11 do 17.11 = 7 dni; rekord 11–17 = 7 (5–9 = 5)
    expect(kafelek("Seria")).toHaveTextContent("Seria7dni");
    expect(kafelek("Rekord")).toHaveTextContent("Rekord7dni");
    expect(kafelek("Skuteczn.")).toHaveTextContent(/Skuteczn\.\d+%/);
  });

  it("kalendarz: „N z M dni zaliczone” dla pokazanego miesiąca", () => {
    render(<MHabitDetail data={dane()} />);
    expect(
      screen.getByRole("heading", { name: "Listopad 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("15 z 17 dni zaliczone")).toBeInTheDocument();
  });

  it("kalendarz cofa się do 5 miesięcy wstecz i nie dalej", async () => {
    render(<MHabitDetail data={dane()} />);
    const wstecz = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    for (let i = 0; i < 5; i++) await userEvent.click(wstecz);
    expect(
      screen.getByRole("heading", { name: "Czerwiec 2026" }),
    ).toBeInTheDocument();
    expect(wstecz).toBeDisabled();
    expect(screen.getByText("0 z 30 dni zaliczone")).toBeInTheDocument();
  });

  it("kalendarz nie cofa się przed start nawyku", async () => {
    const d = dane();
    d.habits[0].schedules[0].validFrom = "2026-10-20";
    render(<MHabitDetail data={d} />);
    const wstecz = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    await userEvent.click(wstecz);
    expect(
      screen.getByRole("heading", { name: "Październik 2026" }),
    ).toBeInTheDocument();
    expect(wstecz).toBeDisabled();
  });

  it("pominięte dni są szare jak w makiecie (nie czerwone jak na webie)", () => {
    render(<MHabitDetail data={dane()} />);
    const pominiety = document.querySelector(
      '[data-day="2026-11-04"]',
    ) as HTMLElement;
    expect(pominiety).toHaveAttribute("data-state", "pominiete");
    expect(pominiety.className).toContain("bg-[#f5f5f5]");
    expect(pominiety.className).toContain("text-[#8a8a8a]");
    expect(pominiety.className).not.toContain("bg-[#fee2e2]");
    // Bez webowej legendy
    expect(
      screen.queryByText("szare: dzień bez nawyku"),
    ).not.toBeInTheDocument();
  });

  it("X/tydz.: „N razy w tym miesiącu” zamiast dni zaliczonych", () => {
    const d = dane();
    d.habits[0].schedules = [
      {
        validFrom: "2026-03-01",
        type: "times_per_week",
        weekdays: [],
        timesPerWeek: 3,
      },
    ];
    render(<MHabitDetail data={d} />);
    expect(screen.getByText("15 razy w tym miesiącu")).toBeInTheDocument();
    expect(screen.queryByText(/dni zaliczone/)).not.toBeInTheDocument();
  });

  it("Notatki: nagłówek nad kartą, notatka z datą", () => {
    render(<MHabitDetail data={dane()} />);
    const naglowek = screen.getByRole("heading", { name: "Notatki" });
    const notatka = screen.getByText("Butelka 1 l na biurku pomaga.");
    // Nagłówek jest poza kartą z notatkami
    expect(naglowek.nextElementSibling).toContainElement(notatka);
    expect(naglowek.parentElement?.className ?? "").not.toContain("border");
    expect(screen.getByText("12.11")).toBeInTheDocument();
  });

  it("„Usuń nawyk” pyta tak samo jak web i usuwa", async () => {
    deleteHabit.mockResolvedValue({ ok: true });
    render(<MHabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń nawyk" }));
    const okno = screen.getByRole("dialog", {
      name: "Usunąć nawyk „Woda 2 l”?",
    });
    expect(
      within(okno).getByText("Historia odhaczeń i notatki zostaną usunięte."),
    ).toBeInTheDocument();
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(deleteHabit).toHaveBeenCalledWith("h1");
    expect(push).toHaveBeenCalledWith("/nawyki");
  });

  it("„Edytuj” otwiera arkusz edycji z wartościami nawyku", async () => {
    render(<MHabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    const okno = screen.getByRole("dialog", { name: "Edytuj nawyk" });
    expect(within(okno).getByRole("textbox", { name: "Nazwa" })).toHaveValue(
      "Woda 2 l",
    );
    await userEvent.click(within(okno).getByRole("button", { name: "Anuluj" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
