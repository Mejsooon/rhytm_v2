import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildMonthGrid } from "@/components/controls/calendar-math";
import type { CategoryRow } from "./load-calendar";
import { planZSzablonu, trening } from "./mobile/fixtures";
import { MonthGrid } from "./month-grid";
import type { Occurrence } from "./occurrences";

const dni = buildMonthGrid(2026, 10, "mon").map((c) => c.date);

const kategorie: CategoryRow[] = [
  {
    id: "c1",
    name: "Studia",
    color: "#0070f3",
    hidden: false,
    is_system: false,
    position: 1,
    user_id: "u1",
    created_at: null,
  },
];

function wystapienie(
  id: string,
  date: string,
  startMin: number,
  nadpisz: Partial<Occurrence> = {},
): Occurrence {
  return {
    key: `${id}:${date}`,
    blockId: id,
    date,
    startMin,
    durationMin: 60,
    title: `Wpis ${id}`,
    categoryId: "c1",
    note: null,
    remind: false,
    recurring: false,
    recurrence: null,
    modified: false,
    ...nadpisz,
  };
}

function wyrenderuj(
  occurrences: Occurrence[],
  nadpisz: Partial<Parameters<typeof MonthGrid>[0]> = {},
) {
  const onDayClick = vi.fn();
  const onEntryClick = vi.fn();
  render(
    <MonthGrid
      days={dni}
      month0={10}
      occurrences={occurrences}
      categories={kategorie}
      today="2026-11-17"
      clock="24"
      onDayClick={onDayClick}
      onEntryClick={onEntryClick}
      {...nadpisz}
    />,
  );
  return { onDayClick, onEntryClick };
}

describe("MonthGrid", () => {
  it("pokazuje nagłówki dni od poniedziałku i 42 komórki", () => {
    wyrenderuj([]);
    const naglowki = screen
      .getAllByTestId("nazwa-dnia")
      .map((e) => e.textContent);
    expect(naglowki).toEqual(["pon", "wt", "śr", "czw", "pt", "sob", "nd"]);
    expect(screen.getAllByTestId(/^komorka-/)).toHaveLength(42);
  });

  it("numer dzisiaj to czerwone kółko size-6, komórka ma min. 124 px", () => {
    wyrenderuj([]);
    const dzis = screen.getByTestId("numer-2026-11-17");
    expect(dzis).toHaveClass("bg-destructive-strong", "size-6", "text-white");
    expect(screen.getByTestId("numer-2026-11-18")).not.toHaveClass(
      "bg-destructive-strong",
    );
    expect(screen.getByTestId("komorka-2026-11-17")).toHaveClass(
      "min-h-[124px]",
    );
  });

  it("komórka z 5 wpisami pokazuje 3 i „+2 więcej”", () => {
    const wpisy = [1, 2, 3, 4, 5].map((i) =>
      wystapienie(`b${i}`, "2026-11-18", 480 + i * 60),
    );
    wyrenderuj(wpisy);
    const komorka = screen.getByTestId("komorka-2026-11-18");
    expect(
      within(komorka).getAllByRole("button", { name: /Wpis/ }),
    ).toHaveLength(3);
    expect(
      within(komorka).getByRole("link", { name: "+2 więcej" }),
    ).toBeInTheDocument();
  });

  it("„+2 więcej” prowadzi do widoku dnia", () => {
    const wpisy = [1, 2, 3, 4, 5].map((i) =>
      wystapienie(`b${i}`, "2026-11-18", 480 + i * 60),
    );
    wyrenderuj(wpisy);
    expect(screen.getByRole("link", { name: "+2 więcej" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=dzien&data=2026-11-18",
    );
  });

  it("wpis ma tytuł, klucz wystąpienia i godzinę wg zegara profilu w podpowiedzi", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 13 * 60 + 30)], {
      clock: "12",
    });
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    expect(wpis).toHaveAttribute("data-occurrence-key", "b1:2026-11-18");
    expect(wpis).toHaveAttribute("title", "1:30 PM Wpis b1");
  });

  it("chip bloku w miesiącu bez paska", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 480)]);
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    // CCalendarMonth: tło kolor+14, ramka 1 px kolor+4d dookoła, bez lewego paska
    expect(wpis.style.backgroundColor).toBe("rgba(0, 112, 243, 0.08)");
    expect(wpis.style.border).toBe("1px solid rgba(0, 112, 243, 0.3)");
    expect(wpis.style.borderLeftWidth).not.toBe("2px");
    expect(wpis.className).not.toContain("border-l-2");
    // Bez zaznaczenia brak pierścienia; nigdy cień wewnętrzny (pasek)
    expect(wpis.style.boxShadow).not.toContain("inset");
    expect(wpis.className).toContain("rounded-sm");
    expect(wpis.className).toContain("text-xs");
  });

  it("zaznaczony chip ma pierścień 2 px w kolorze kategorii, a fokus to outline", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 480)], {
      activeEntryKey: "b1:2026-11-18",
    });
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    expect(wpis.style.boxShadow).toBe("rgba(0, 112, 243, 0.4) 0px 0px 0px 2px");
    expect(wpis.style.boxShadow).not.toContain("inset");
    expect(wpis.className).toContain("focus-visible:outline-ring");
    expect(wpis).toHaveAttribute("aria-expanded", "true");
  });

  it("wpis bez kategorii jak w tygodniu: kolor #a3a3a3, pełna ramka 4d i tło 14, bez przerywanej ramki", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 480, { categoryId: null })]);
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    expect(wpis.style.backgroundColor).toBe("rgba(163, 163, 163, 0.08)");
    expect(wpis.style.border).toBe("1px solid rgba(163, 163, 163, 0.3)");
    expect(wpis.className).not.toContain("border-dashed");
    expect(wpis.className).not.toContain("bg-background");
    expect(wpis.className).toContain("text-foreground");
    expect(wpis.className).not.toContain("font-mono");
  });

  it("zaznaczony wpis bez kategorii ma pierścień 2 px #a3a3a366, a plan treningu nadal przerywaną ramkę i tło bg-background", () => {
    wyrenderuj([wystapienie("b1", "2026-11-18", 480, { categoryId: null })], {
      activeEntryKey: "b1:2026-11-18",
      sport: [planZSzablonu()],
    });
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    expect(wpis.style.boxShadow).toBe(
      "rgba(163, 163, 163, 0.4) 0px 0px 0px 2px",
    );
    expect(wpis).toHaveAttribute("aria-expanded", "true");
    const plan = screen.getByRole("link", { name: "Push" });
    expect(plan).toHaveClass("bg-background");
    expect(plan.style.backgroundColor).toBe("");
    expect(plan.style.border).toContain("dashed");
  });

  it("klik w „+2 więcej” woła onMoreClick", async () => {
    const onMoreClick = vi.fn();
    const wpisy = [1, 2, 3, 4, 5].map((i) =>
      wystapienie(`b${i}`, "2026-11-18", 480 + i * 60),
    );
    wyrenderuj(wpisy, { onMoreClick });
    await userEvent.click(screen.getByRole("link", { name: "+2 więcej" }));
    expect(onMoreClick).toHaveBeenCalled();
  });

  it("klik we wpis woła onEntryClick z kluczem i elementem, nie otwiera „Nowy wpis”", async () => {
    const { onEntryClick, onDayClick } = wyrenderuj([
      wystapienie("b1", "2026-11-18", 480),
    ]);
    const wpis = screen.getByRole("button", { name: /Wpis b1/ });
    await userEvent.click(wpis);
    expect(onEntryClick).toHaveBeenCalledWith("b1:2026-11-18", wpis);
    expect(onDayClick).not.toHaveBeenCalled();
  });

  it("klik w pustą część komórki woła onDayClick z datą i komórką", () => {
    const { onDayClick } = wyrenderuj([]);
    const komorka = screen.getByTestId("komorka-2026-11-19");
    fireEvent.click(komorka);
    expect(onDayClick).toHaveBeenCalledWith("2026-11-19", komorka);
  });

  it("przycisk „+” komórki działa z klawiatury i woła onDayClick", async () => {
    const { onDayClick } = wyrenderuj([]);
    await userEvent.click(
      screen.getByRole("button", { name: "Nowy wpis 19.11" }),
    );
    expect(onDayClick).toHaveBeenCalledTimes(1);
    expect(onDayClick.mock.calls[0][0]).toBe("2026-11-19");
  });

  it("wyróżnia dziś i szarzy dni spoza miesiąca", () => {
    wyrenderuj([]);
    expect(screen.getByTestId("numer-2026-11-17").className).toContain(
      "bg-destructive-strong",
    );
    expect(screen.getByTestId("numer-2026-10-26").className).toContain(
      "text-faint-foreground",
    );
    expect(screen.getByTestId("numer-2026-11-10").className).not.toContain(
      "text-faint-foreground",
    );
  });

  describe("podgląd treningów", () => {
    it("bieg wykonany jest pełny, plan z szablonu przerywany; klik prowadzi na /sport", async () => {
      const { onDayClick, onEntryClick } = wyrenderuj([], {
        sport: [trening(), planZSzablonu()],
      });
      const bieg = within(screen.getByTestId("komorka-2026-11-17")).getByRole(
        "link",
        { name: "Spokojny" },
      );
      // Wykonany jak chip bloku: tło 14, ramka 4d, bez paska
      expect(bieg.style.backgroundColor).toBe("rgba(194, 65, 12, 0.08)");
      expect(bieg.style.border).toBe("1px solid rgba(194, 65, 12, 0.3)");
      expect(bieg).toHaveAttribute(
        "href",
        "/sport?miesiac=2026-11&wybrany=s:s1",
      );
      const plan = within(screen.getByTestId("komorka-2026-11-19")).getByRole(
        "link",
        { name: "Push" },
      );
      expect(plan.style.border).toBe("1px dashed rgb(194, 65, 12)");
      expect(plan).toHaveAttribute("data-planned", "true");
      // Klik w trening nie otwiera „Nowy wpis” ani dymku bloku
      // jsdom nie przechodzi na inny dokument: blokujemy domyślną nawigację linku
      plan.addEventListener("click", (e) => e.preventDefault());
      fireEvent.click(plan);
      expect(onDayClick).not.toHaveBeenCalled();
      expect(onEntryClick).not.toHaveBeenCalled();
    });

    it("trening liczy się do limitu 3 wpisów i stoi wg godziny", () => {
      wyrenderuj(
        [
          wystapienie("a", "2026-11-17", 360),
          wystapienie("b", "2026-11-17", 480),
          wystapienie("c", "2026-11-17", 600),
        ],
        { sport: [trening()] },
      );
      const komorka = within(screen.getByTestId("komorka-2026-11-17"));
      // 07:00 trening wchodzi między 06:00 a 08:00, ostatni blok trafia do „+1 więcej”
      expect(
        komorka.getAllByRole("button").map((b) => b.textContent),
      ).toContain("Wpis a");
      expect(komorka.getByRole("link", { name: "Spokojny" })).toBeVisible();
      expect(komorka.queryByText("Wpis c")).not.toBeInTheDocument();
      expect(komorka.getByText("+1 więcej")).toBeInTheDocument();
    });
  });
});
