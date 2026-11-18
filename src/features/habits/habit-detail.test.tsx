import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, deleteHabit, addHabitNote, updateHabit, createHabit } = vi.hoisted(() => ({
  push: vi.fn(),
  deleteHabit: vi.fn(),
  addHabitNote: vi.fn(),
  updateHabit: vi.fn(),
  createHabit: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock("./actions", () => ({ deleteHabit, addHabitNote, updateHabit, createHabit }));

import { HabitDetail } from "./habit-detail";
import type { HabitDetailData } from "./load-habits";

function dane(): HabitDetailData {
  return {
    today: "2026-11-17", // wtorek
    weekStart: "mon",
    clock: "24",
    sleepGoalMin: 480,
    habits: [
      {
        id: "h1",
        name: "Rozciąganie",
        remindAt: "20:30",
        showOnToday: true,
        createdAt: "",
        schedules: [
          { validFrom: "2026-10-01", type: "times_per_week", weekdays: [], timesPerWeek: 3 },
          { validFrom: "2026-11-01", type: "weekdays", weekdays: [1, 3, 5, 7], timesPerWeek: null },
        ],
      },
    ],
    // 1.11 nd, 2.11 pn, 6.11 pt, 9.11 pn, 16.11 pn zrobione; 4.11 (śr) pominięte
    checks: ["2026-11-01", "2026-11-02", "2026-11-06", "2026-11-09", "2026-11-16"].map((date) => ({
      habitId: "h1",
      date,
    })),
    sleepLogs: [],
    notes: [
      { id: "n2", date: "2026-11-10", text: "Nowsza notatka" },
      { id: "n1", date: "2026-11-02", text: "Starsza notatka" },
    ],
  };
}

function komorka(date: string) {
  return document.querySelector(`[data-day="${date}"]`) as HTMLElement;
}

beforeEach(() => vi.clearAllMocks());

describe("HabitDetail", () => {
  it("nagłówek: okruszek i opis harmonogramu z przypomnieniem", () => {
    render(<HabitDetail data={dane()} />);
    expect(screen.getByRole("link", { name: "Nawyki i sen" })).toHaveAttribute("href", "/nawyki");
    expect(screen.getByRole("heading", { level: 1, name: "Rozciąganie" })).toBeInTheDocument();
    expect(screen.getByText("pn, śr, pt, nd · przypomnienie 20:30 · od 01.10.2026")).toBeInTheDocument();
  });

  it("bez przypomnienia pomija ten fragment", () => {
    const d = dane();
    d.habits[0].remindAt = null;
    render(<HabitDetail data={d} />);
    expect(screen.getByText("pn, śr, pt, nd · od 01.10.2026")).toBeInTheDocument();
  });

  it("kafelki: seria, najdłuższa seria, 30 dni i łącznie", () => {
    render(<HabitDetail data={dane()} />);
    const kafelek = (nazwa: string) => screen.getByText(nazwa).parentElement as HTMLElement;
    // 16.11 zrobione, 14.11 (sb, poza planem) pomijane, 13.11 (pt) nieodhaczone → seria 1 dzień
    expect(kafelek("Seria")).toHaveTextContent("1dzień");
    expect(kafelek("Najdłuższa seria")).toHaveTextContent("Najdłuższa seria2dni");
    expect(kafelek("30 dni")).toHaveTextContent(/\d+%/);
    expect(kafelek("Łącznie")).toHaveTextContent("5razy");
  });

  it("kalendarz: zrobione, pominięte, szare i legenda", () => {
    render(<HabitDetail data={dane()} />);
    expect(screen.getByRole("heading", { name: "Listopad 2026" })).toBeInTheDocument();
    expect(komorka("2026-11-02")).toHaveAttribute("data-state", "zrobione");
    expect(komorka("2026-11-04")).toHaveAttribute("data-state", "pominiete"); // śr zaplanowana, bez odhaczenia
    expect(komorka("2026-11-03")).toHaveAttribute("data-state", "szare"); // wt poza planem
    expect(komorka("2026-11-18")).toHaveAttribute("data-state", "przyszlosc");
    expect(screen.getByText("zrobione")).toBeInTheDocument();
    expect(screen.getByText("pominięte")).toBeInTheDocument();
    expect(screen.getByText("szare: dzień bez nawyku")).toBeInTheDocument();
  });

  it("nawigacja miesięcy: › wyłączony w bieżącym, ‹ na miesiącu startu", async () => {
    render(<HabitDetail data={dane()} />);
    const wstecz = screen.getByRole("button", { name: "Poprzedni miesiąc" });
    const dalej = screen.getByRole("button", { name: "Następny miesiąc" });
    expect(dalej).toBeDisabled();
    expect(wstecz).toBeEnabled();
    await userEvent.click(wstecz);
    expect(screen.getByRole("heading", { name: "Październik 2026" })).toBeInTheDocument();
    expect(wstecz).toBeDisabled(); // nawyk ruszył 1.10
    expect(dalej).toBeEnabled();
    // X/tydz. w październiku: nieodhaczone dni w przeszłości są neutralne, nie „pominięte”
    expect(komorka("2026-10-05")).toHaveAttribute("data-state", "neutralne");
    // dni przed startem są szare
    expect(komorka("2026-09-30")).toHaveAttribute("data-state", "szare");
  });

  it("historia harmonogramu: zakresy, opisy i dopisek", () => {
    render(<HabitDetail data={dane()} />);
    const karta = screen.getByRole("heading", { name: "Historia harmonogramu" }).closest("section") as HTMLElement;
    const wiersze = within(karta).getAllByText(/^(od |\d\d\.\d\d – )/);
    expect(wiersze.map((w) => w.textContent)).toEqual(["od 01.11.2026", "01.10 – 31.10.2026"]);
    expect(within(karta).getByText("3× w tygodniu")).toBeInTheDocument();
    expect(within(karta).getByText("pn, śr, pt, nd")).toBeInTheDocument();
    expect(within(karta).getByText("Zmiana harmonogramu nie przelicza przeszłych dni.")).toBeInTheDocument();
  });

  it("Usuń → potwierdzenie → deleteHabit → /nawyki", async () => {
    deleteHabit.mockResolvedValue({ ok: true });
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByText("Usunąć nawyk „Rozciąganie”?")).toBeInTheDocument();
    expect(screen.getByText("Historia odhaczeń i notatki zostaną usunięte.")).toBeInTheDocument();
    const okno = screen.getByRole("dialog");
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(deleteHabit).toHaveBeenCalledWith("h1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/nawyki"));
  });

  it("błąd usuwania pokazuje komunikat i zostaje na stronie", async () => {
    deleteHabit.mockResolvedValue({ ok: false, message: "Nie znaleziono nawyku." });
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Nie znaleziono nawyku.");
    expect(push).not.toHaveBeenCalled();
  });

  it("Edytuj otwiera okno edycji nawyku", async () => {
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Edytuj" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("notatki: lista od najnowszej, Enter zapisuje przycięty tekst", async () => {
    addHabitNote.mockResolvedValue({ ok: true });
    render(<HabitDetail data={dane()} />);
    expect(screen.getByText("10.11")).toBeInTheDocument();
    expect(screen.getByText("Nowsza notatka")).toBeInTheDocument();
    const pole = screen.getByPlaceholderText("Dodaj notatkę");
    await userEvent.type(pole, "  Mocny trening  {Enter}");
    expect(addHabitNote).toHaveBeenCalledWith("h1", "Mocny trening");
    await waitFor(() => expect(pole).toHaveValue(""));
  });

  it("notatki: pusty tekst nie woła akcji, błąd widać pod polem", async () => {
    addHabitNote.mockResolvedValue({ ok: false, message: "Notatka może mieć maksymalnie 500 znaków." });
    render(<HabitDetail data={dane()} />);
    const pole = screen.getByPlaceholderText("Dodaj notatkę");
    await userEvent.type(pole, "   {Enter}");
    expect(addHabitNote).not.toHaveBeenCalled();
    await userEvent.type(pole, "x{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("Notatka może mieć maksymalnie 500 znaków.");
    expect(pole).toHaveValue("   x");
  });

  it("podwójny Enter w trakcie zapisu woła addHabitNote raz", async () => {
    let zakoncz: (w: { ok: true }) => void = () => {};
    addHabitNote.mockReturnValue(new Promise((r) => (zakoncz = r)));
    render(<HabitDetail data={dane()} />);
    const pole = screen.getByPlaceholderText("Dodaj notatkę");
    await userEvent.type(pole, "Raz{Enter}{Enter}");
    expect(addHabitNote).toHaveBeenCalledTimes(1);
    expect(pole).toHaveFocus();
    zakoncz({ ok: true });
    await waitFor(() => expect(pole).toHaveValue(""));
    expect(pole).toHaveFocus();
  });
});
