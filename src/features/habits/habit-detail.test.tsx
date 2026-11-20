import { render, screen, waitFor, within } from "@testing-library/react";
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
vi.mock("./actions", () => ({
  deleteHabit,
  addHabitNote,
  updateHabit,
  createHabit,
}));
// Drzewo telefonu (w DOM obok webu) ma własne testy; tu sprawdzamy web
vi.mock("./mobile/m-habit-detail", () => ({ MHabitDetail: () => null }));

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
          {
            validFrom: "2026-10-01",
            type: "times_per_week",
            weekdays: [],
            timesPerWeek: 3,
          },
          {
            validFrom: "2026-11-01",
            type: "weekdays",
            weekdays: [1, 3, 5, 7],
            timesPerWeek: null,
          },
        ],
      },
    ],
    // 1.11 nd, 2.11 pn, 6.11 pt, 9.11 pn, 16.11 pn zrobione; 4.11 (śr) pominięte
    checks: [
      "2026-11-01",
      "2026-11-02",
      "2026-11-06",
      "2026-11-09",
      "2026-11-16",
    ].map((date) => ({
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
    expect(screen.getByRole("link", { name: "Nawyki i sen" })).toHaveAttribute(
      "href",
      "/nawyki",
    );
    expect(
      screen.getByRole("heading", { level: 1, name: "Rozciąganie" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("pn, śr, pt, nd · przypomnienie 20:30 · od 01.10.2026"),
    ).toBeInTheDocument();
  });

  it("bez przypomnienia pomija ten fragment", () => {
    const d = dane();
    d.habits[0].remindAt = null;
    render(<HabitDetail data={d} />);
    expect(
      screen.getByText("pn, śr, pt, nd · od 01.10.2026"),
    ).toBeInTheDocument();
  });

  it("kafelki: seria, najdłuższa seria, 30 dni i łącznie", () => {
    render(<HabitDetail data={dane()} />);
    const kafelek = (nazwa: string) =>
      screen.getByText(nazwa).parentElement as HTMLElement;
    // 16.11 zrobione, 14.11 (sb, poza planem) pomijane, 13.11 (pt) nieodhaczone → seria 1 dzień
    expect(kafelek("Seria")).toHaveTextContent("1dzień");
    expect(kafelek("Najdłuższa seria")).toHaveTextContent(
      "Najdłuższa seria2dni",
    );
    expect(kafelek("30 dni")).toHaveTextContent(/\d+%/);
    expect(kafelek("Łącznie")).toHaveTextContent("5razy");
  });

  it("kalendarz: zrobione, pominięte, szare i legenda", () => {
    render(<HabitDetail data={dane()} />);
    expect(
      screen.getByRole("heading", { name: "Listopad 2026" }),
    ).toBeInTheDocument();
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
    expect(
      screen.getByRole("heading", { name: "Październik 2026" }),
    ).toBeInTheDocument();
    expect(wstecz).toBeDisabled(); // nawyk ruszył 1.10
    expect(dalej).toBeEnabled();
    // X/tydz. w październiku: nieodhaczone dni w przeszłości są neutralne, nie „pominięte”
    expect(komorka("2026-10-05")).toHaveAttribute("data-state", "neutralne");
    // dni przed startem są szare
    expect(komorka("2026-09-30")).toHaveAttribute("data-state", "szare");
  });

  it("historia harmonogramu: zakresy, opisy i dopisek", () => {
    render(<HabitDetail data={dane()} />);
    const karta = screen
      .getByRole("heading", { name: "Historia harmonogramu" })
      .closest("section") as HTMLElement;
    const wiersze = within(karta).getAllByText(/^(od |\d\d\.\d\d – )/);
    expect(wiersze.map((w) => w.textContent)).toEqual([
      "od 01.11.2026",
      "01.10 – 31.10.2026",
    ]);
    expect(within(karta).getByText("3× w tygodniu")).toBeInTheDocument();
    expect(within(karta).getByText("pn, śr, pt, nd")).toBeInTheDocument();
    expect(
      within(karta).getByText(
        "Zmiana harmonogramu nie przelicza przeszłych dni.",
      ),
    ).toBeInTheDocument();
  });

  it("Usuń → potwierdzenie → deleteHabit → /nawyki", async () => {
    deleteHabit.mockResolvedValue({ ok: true });
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByText("Usunąć nawyk „Rozciąganie”?")).toBeInTheDocument();
    expect(
      screen.getByText("Historia odhaczeń i notatki zostaną usunięte."),
    ).toBeInTheDocument();
    const okno = screen.getByRole("dialog");
    await userEvent.click(within(okno).getByRole("button", { name: "Usuń" }));
    expect(deleteHabit).toHaveBeenCalledWith("h1");
    await waitFor(() => expect(push).toHaveBeenCalledWith("/nawyki"));
  });

  it("błąd usuwania pokazuje komunikat i zostaje na stronie", async () => {
    deleteHabit.mockResolvedValue({
      ok: false,
      message: "Nie znaleziono nawyku.",
    });
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    await userEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Usuń" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie znaleziono nawyku.",
    );
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
    addHabitNote.mockResolvedValue({
      ok: false,
      message: "Notatka może mieć maksymalnie 500 znaków.",
    });
    render(<HabitDetail data={dane()} />);
    const pole = screen.getByPlaceholderText("Dodaj notatkę");
    await userEvent.type(pole, "   {Enter}");
    expect(addHabitNote).not.toHaveBeenCalled();
    await userEvent.type(pole, "x{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Notatka może mieć maksymalnie 500 znaków.",
    );
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
  it("nagłówek .topbar: okruszki .crumb, Usuń destructive-outline, Edytuj primary", () => {
    render(<HabitDetail data={dane()} />);
    const link = screen.getByRole("link", { name: "Nawyki i sen" });
    const okruszki = link.parentElement as HTMLElement;
    expect(okruszki.className).toContain("text-sm");
    expect(okruszki.className).toContain("text-muted-foreground");
    const naglowek = okruszki.closest("header") as HTMLElement;
    expect(naglowek.className).toContain("px-6");
    expect(naglowek.className).toContain("py-2.5");
    const usun = screen.getByRole("button", { name: "Usuń" });
    // destructive-outline (.btndo), rozmiar md 32 px
    expect(usun.className).toContain("border-input");
    expect(usun.className).toContain("text-destructive-foreground");
    expect(usun.className).toContain("h-8");
    expect(usun.querySelector("svg")).not.toBeNull();
    const edytuj = screen.getByRole("button", { name: "Edytuj" });
    expect(edytuj.className).toContain("bg-primary");
    expect(edytuj.className).toContain("h-8");
  });

  it("długa nazwa skraca się wielokropkiem w okruszkach i tytule", () => {
    const d = dane();
    d.habits[0].name = "Bardzo długa nazwa nawyku ".repeat(8).trim();
    render(<HabitDetail data={d} />);
    const okruszek = screen
      .getByRole("link", { name: "Nawyki i sen" })
      .parentElement?.querySelector("b") as HTMLElement;
    expect(okruszek).toHaveTextContent(d.habits[0].name);
    expect(okruszek.className).toContain("truncate");
    expect(okruszek.className).toContain("min-w-0");
    const tytul = screen.getByRole("heading", { level: 1 });
    expect(tytul.className).toContain("truncate");
  });

  it("podtytuł jak .hint, kafelki jako osobne karty .card", () => {
    render(<HabitDetail data={dane()} />);
    const podtytul = screen.getByText(
      "pn, śr, pt, nd · przypomnienie 20:30 · od 01.10.2026",
    );
    expect(podtytul.className).not.toContain("font-mono");
    expect(podtytul.className).toContain("text-muted-foreground");
    const etykieta = screen.getByText("Łącznie");
    expect(etykieta.className).toContain("text-xs");
    expect(etykieta.className).toContain("font-medium");
    expect(etykieta.className).not.toContain("uppercase");
    const kafelek = etykieta.parentElement as HTMLElement;
    expect(kafelek.className).toContain("rounded-xl");
    expect(kafelek.className).toContain("shadow-card");
    const wartosc = etykieta.nextElementSibling as HTMLElement;
    expect(wartosc.className).toContain("text-[26px]");
    expect(wartosc.className).toContain("font-semibold");
    expect(wartosc.className).toContain("tabular-nums");
    expect(wartosc.className).not.toContain("font-mono");
    expect(kafelek.parentElement?.className).toContain("gap-3");
  });

  it("kalendarz, historia i notatki to karty .card z nagłówkiem .card-t", () => {
    render(<HabitDetail data={dane()} />);
    for (const nazwa of ["Listopad 2026", "Historia harmonogramu", "Notatki"]) {
      const h = screen.getByRole("heading", { name: nazwa });
      expect(h.className).toContain("text-base");
      const karta = h.closest("section") as HTMLElement;
      expect(karta.className).toContain("rounded-xl");
      expect(karta.className).toContain("shadow-card");
    }
    const dopisek = screen.getByText(
      "Zmiana harmonogramu nie przelicza przeszłych dni.",
    );
    // stopka .foot z ikoną informacji
    expect(dopisek.className).toContain("text-xs");
    expect(dopisek.parentElement?.className).toContain("bg-black/[.025]");
    expect(dopisek.parentElement?.querySelector("svg")).not.toBeNull();
    expect(screen.getByText("od 01.11.2026").className).toContain(
      "tabular-nums",
    );
    expect(screen.getByText("3× w tygodniu").className).toContain(
      "font-medium",
    );
    // pole notatki jak .inp
    expect(screen.getByPlaceholderText("Dodaj notatkę").className).toContain(
      "shadow-xs",
    );
  });

  it("komórki kalendarza jak w makiecie; dziś z pierścieniem w style", () => {
    render(<HabitDetail data={dane()} />);
    const zrobione = komorka("2026-11-02");
    expect(zrobione.className).toContain("bg-success");
    expect(zrobione.className).toContain("border-success");
    expect(zrobione.className).toContain("rounded-[8px]");
    expect(zrobione.className).toContain("tabular-nums");
    expect(zrobione.className).not.toContain("font-mono");
    expect(komorka("2026-11-04").className).toContain("bg-destructive/10");
    expect(komorka("2026-11-03").className).toContain("border-border");
    expect(komorka("2026-11-18").className).toContain("border-dashed");
    // dzień spoza miesiąca: przezroczysty
    expect(komorka("2026-12-01").className).toContain("bg-transparent");
    expect(komorka("2026-11-17").style.boxShadow).toContain(
      "var(--foreground)",
    );
    expect(komorka("2026-11-16").style.boxShadow).toBe("");
  });

  it("okno usuwania w stylu .dlg: opis 14 px, Usuń destructive z koszem", async () => {
    render(<HabitDetail data={dane()} />);
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    const okno = screen.getByRole("dialog");
    expect(
      within(okno).getByText("Historia odhaczeń i notatki zostaną usunięte.")
        .className,
    ).toContain("text-sm");
    const usun = within(okno).getByRole("button", { name: "Usuń" });
    expect(usun.className).toContain("bg-destructive");
    expect(usun.querySelector("svg")).not.toBeNull();
    expect(
      within(okno).getByRole("button", { name: "Anuluj" }).className,
    ).toContain("bg-transparent");
  });
});
