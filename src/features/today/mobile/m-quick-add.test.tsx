import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createBlock,
  saveRun,
  createHabit,
  refresh,
  toastSuccess,
} = vi.hoisted(() => ({
  createBlock: vi.fn(),
  saveRun: vi.fn(),
  createHabit: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));
vi.mock("@/features/calendar/actions", () => ({ createBlock }));
vi.mock("@/features/sport/actions", () => ({ saveRun }));
vi.mock("@/features/habits/actions", () => ({ createHabit }));
vi.mock("sonner", () => ({ toast: { success: toastSuccess } }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));

import { kategoria } from "@/features/calendar/mobile/fixtures";
import { MQuickAdd } from "./m-quick-add";

// Wtorek 17.11.2026, 10:20, tydzień od poniedziałku → następny tydzień od Pn 23.11
const kategorie = [
  { ...kategoria("sys", "Sport", "#c2410c"), is_system: true, position: 0 },
  { ...kategoria("ukr", "Ukryta", "#999999"), hidden: true, position: 1 },
  { ...kategoria("c3", "Praca", "#0070f3"), position: 3 },
  { ...kategoria("c2", "Studia", "#15803d"), position: 2 },
];

function pokaz(onClose = vi.fn()) {
  render(
    <MQuickAdd
      today="2026-11-17"
      nowMin={10 * 60 + 20}
      weekStart="mon"
      categories={kategorie}
      onClose={onClose}
    />,
  );
  return onClose;
}

function chipy() {
  const kiedy = screen.queryByRole("group", { name: "Kiedy" });
  return kiedy
    ? within(kiedy)
        .getAllByRole("button")
        .map((b) => b.textContent)
    : [];
}

beforeEach(() => {
  createBlock.mockResolvedValue({ ok: true });
  saveRun.mockResolvedValue({ ok: true });
  createHabit.mockResolvedValue({ ok: true });
});
afterEach(() => vi.clearAllMocks());

describe("MQuickAdd", () => {
  it("segment zmienia etykietę, placeholder i chipy", async () => {
    const user = userEvent.setup();
    pokaz();
    expect(
      screen.getByRole("dialog", { name: "Szybko dodaj" }),
    ).toBeInTheDocument();
    // Domyślny rodzaj to „Blok”; rodzaju „Zadanie” nie ma (zadanie należy do bloku)
    expect(screen.queryByRole("radio", { name: "Zadanie" })).toBeNull();
    expect(screen.getByRole("radio", { name: "Blok" })).toBeChecked();
    expect(screen.getByLabelText("Blok w kalendarzu")).toHaveAttribute(
      "placeholder",
      "Nazwa bloku, np. Nauka SQL",
    );
    expect(chipy()).toEqual(["Dziś", "Dziś 18:00", "Jutro", "Pn 23.11"]);

    await user.click(screen.getByRole("radio", { name: "Bieg" }));
    expect(screen.getByLabelText("Bieg")).toHaveAttribute(
      "placeholder",
      "Np. 8 km spokojnie",
    );
    expect(chipy()).toEqual(["Dziś", "Dziś 18:00", "Jutro", "Pn 23.11"]);

    await user.click(screen.getByRole("radio", { name: "Nawyk" }));
    expect(screen.getByLabelText("Nawyk")).toHaveAttribute(
      "placeholder",
      "Np. Woda 2 l",
    );
    // Nawyk: bez chipów „Kiedy”
    expect(chipy()).toEqual([]);
    expect(screen.queryByText("Kiedy")).not.toBeInTheDocument();
  });

  it("„Dodaj” jest nieaktywne przy pustym polu", async () => {
    const user = userEvent.setup();
    pokaz();
    const dodaj = screen.getByRole("button", { name: "Dodaj" });
    expect(dodaj).toBeDisabled();
    await user.type(screen.getByLabelText("Blok w kalendarzu"), "   ");
    expect(dodaj).toBeDisabled();
    await user.type(screen.getByLabelText("Blok w kalendarzu"), "Pranie");
    expect(dodaj).toBeEnabled();
  });

  it("blok „Dziś 18:00” → 18:00–19:00 z pierwszą widoczną kategorią", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Blok" }));
    await user.type(screen.getByLabelText("Blok w kalendarzu"), "Nauka SQL");
    await user.click(screen.getByRole("button", { name: "Dziś 18:00" }));
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(createBlock).toHaveBeenCalledWith({
      title: "Nauka SQL",
      categoryId: "c2",
      date: "2026-11-17",
      startMin: 18 * 60,
      durationMin: 60,
      recurrence: null,
      note: "",
      remind: true,
    });
  });

  it("bieg „8 km spokojnie” „Jutro” → plan easy 8 km jutro 18:00", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Bieg" }));
    await user.type(screen.getByLabelText("Bieg"), "8 km spokojnie");
    await user.click(screen.getByRole("button", { name: "Jutro" }));
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(saveRun).toHaveBeenCalledWith({
      kind: "easy",
      date: "2026-11-18",
      start: "18:00",
      distanceKm: 8,
      durationS: null,
      difficulty: null,
      note: "",
      showInCalendar: true,
    });
  });

  it("nawyk → codzienny z nazwą z pola", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Nawyk" }));
    await user.type(screen.getByLabelText("Nawyk"), "Woda 2 l");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(createHabit).toHaveBeenCalledWith({
      name: "Woda 2 l",
      schedule: { type: "daily", weekdays: [], timesPerWeek: null },
      remindAt: null,
      showOnToday: true,
    });
  });

  it("błąd zostaje w arkuszu", async () => {
    createBlock.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    const user = userEvent.setup();
    const onClose = pokaz();
    await user.type(screen.getByLabelText("Blok w kalendarzu"), "Pranie");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(onClose).not.toHaveBeenCalled();
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("link „Pełny formularz bloku” niesie datę, godzinę i tytuł", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Blok" }));
    await user.type(screen.getByLabelText("Blok w kalendarzu"), "Nauka & SQL");
    await user.click(screen.getByRole("button", { name: "Jutro" }));
    expect(
      screen.getByRole("link", { name: /Pełny formularz bloku/ }),
    ).toHaveAttribute(
      "href",
      "/kalendarz?nowy=blok&data=2026-11-18&godzina=09:00&tytul=Nauka%20%26%20SQL",
    );
    expect(
      screen.queryByRole("link", { name: /Pełny formularz biegu/ }),
    ).not.toBeInTheDocument();
  });

  it("link „Pełny formularz biegu” niesie datę i godzinę", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Bieg" }));
    expect(
      screen.getByRole("link", { name: /Pełny formularz biegu/ }),
    ).toHaveAttribute("href", "/sport?nowy=bieg&data=2026-11-17&godzina=11:00");
  });

  it("stuknięcie „Pełny formularz” zamyka arkusz (Activity nie trzyma go otwartego)", async () => {
    const user = userEvent.setup();
    const onClose = pokaz();
    await user.click(screen.getByRole("radio", { name: "Blok" }));
    // jsdom nie nawiguje między dokumentami — blokujemy domyślną akcję linku (bez szumu w logu)
    const bezNawigacji = (e: Event) => e.preventDefault();
    document.addEventListener("click", bezNawigacji);
    await user.click(
      screen.getByRole("link", { name: /Pełny formularz bloku/ }),
    );
    document.removeEventListener("click", bezNawigacji);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("„Zamknij” zamyka arkusz", async () => {
    const user = userEvent.setup();
    const onClose = pokaz();
    await user.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onClose).toHaveBeenCalled();
  });
});
