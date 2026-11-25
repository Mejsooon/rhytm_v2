import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildMonthGrid } from "@/components/controls/calendar-math";
import { kategoria, odnowienie, planZSzablonu, trening, wystapienie } from "./fixtures";
import { MCalendarMonth } from "./m-calendar-month";

const dni = buildMonthGrid(2026, 10, "mon").map((c) => c.date);
const kategorie = [
  kategoria("c1", "Studia", "#0070f3"),
  kategoria("c2", "Dom", "#525252"),
  kategoria("c3", "Sport", "#c2410c"),
  kategoria("c4", "Praca", "#7c3aed"),
];
const wystapienia = [
  wystapienie("a:2026-11-10", "2026-11-10", 480, 60, "A", "c1"),
  wystapienie("b:2026-11-10", "2026-11-10", 540, 60, "B", "c2"),
  wystapienie("c:2026-11-10", "2026-11-10", 600, 60, "C", "c3"),
  wystapienie("d:2026-11-10", "2026-11-10", 660, 60, "D", "c4"),
  wystapienie("e:2026-11-10", "2026-11-10", 720, 60, "E", "c1"),
  wystapienie("f:2026-11-12", "2026-11-12", 600, 90, "Siłownia", "c3"),
];

function wyrenderuj(
  over: Partial<React.ComponentProps<typeof MCalendarMonth>> = {},
) {
  return render(
    <MCalendarMonth
      days={dni}
      date="2026-11-12"
      today="2026-11-17"
      occurrences={wystapienia}
      categories={kategorie}
      clock="24"
      onAdd={() => {}}
      onBlockClick={() => {}}
      {...over}
    />,
  );
}

describe("MCalendarMonth", () => {
  it("dzień z 4 kategoriami ma 3 kropki", () => {
    wyrenderuj();
    const komorka = screen.getByRole("button", { name: "10 listopada" });
    expect(within(komorka).getAllByTestId("kropka-kategorii")).toHaveLength(3);
  });

  it("dzień bez bloków nie ma kropek", () => {
    wyrenderuj();
    expect(
      within(
        screen.getByRole("button", { name: "11 listopada" }),
      ).queryAllByTestId("kropka-kategorii"),
    ).toHaveLength(0);
  });

  it("wybrany dzień jest czarny i pokazuje swoje bloki pod siatką", () => {
    wyrenderuj();
    expect(
      screen.getByRole("button", { name: "12 listopada" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(
      screen.getByRole("button", { name: "12 listopada" }).className,
    ).toContain("bg-primary");
    expect(
      screen.getByRole("heading", { name: "12 listopada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Siłownia/ })).toHaveTextContent(
      "10:00",
    );
  });

  it("wybór dnia zmienia listę, a pusty dzień mówi „Brak bloków — dodaj”", async () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "10 listopada" }));
    expect(
      screen.getAllByRole("button", { name: /^\d\d:\d\d[A-E]$/ }),
    ).toHaveLength(5);
    await userEvent.click(screen.getByRole("button", { name: "11 listopada" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Brak bloków — dodaj" }),
    );
    expect(onAdd).toHaveBeenCalledWith("2026-11-11", 540);
  });

  it("stuknięcie bloku woła onBlockClick, „Otwórz dzień” prowadzi do dnia", async () => {
    const onBlockClick = vi.fn();
    const { container } = wyrenderuj({ onBlockClick });
    await userEvent.click(screen.getByRole("button", { name: /Siłownia/ }));
    expect(onBlockClick).toHaveBeenCalledWith("f:2026-11-12");
    expect(container.querySelector("[data-occurrence-key]")).toBeNull();
    expect(screen.getByRole("link", { name: "Otwórz dzień" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=dzien&data=2026-11-12",
    );
  });

  it("dziś niewybrane ma czerwone kółko, dziś wybrane to sama czarna kafelka", async () => {
    wyrenderuj();
    const dzis = screen.getByRole("button", { name: "17 listopada" });
    expect(dzis.querySelector("[data-dzis]")).toHaveClass(
      "bg-destructive-strong",
    );
    await userEvent.click(dzis);
    expect(dzis).toHaveClass("bg-primary");
    expect(dzis.querySelector("[data-dzis]")).not.toHaveClass(
      "bg-destructive-strong",
    );
  });

  it("pusty dzień: przerywany przycisk 56 px z plusem dodaje blok na ten dzień", async () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "11 listopada" }));
    const dodaj = screen.getByRole("button", { name: "Brak bloków — dodaj" });
    expect(dodaj).toHaveClass("border-dashed", "h-14");
    expect(dodaj.querySelector("svg")).not.toBeNull();
    await userEvent.click(dodaj);
    expect(onAdd).toHaveBeenCalledWith("2026-11-11", 540);
  });

  it("nagłówki dni tygodnia zależą od początku tygodnia", () => {
    wyrenderuj();
    expect(screen.getByText("pn")).toBeInTheDocument();
  });
});

describe("MCalendarMonth — podgląd treningów", () => {
  it("dzień z treningiem ma kropkę Sportu, a lista dnia link do /sport", async () => {
    wyrenderuj({ sport: [planZSzablonu()] });
    const komorka = screen.getByRole("button", { name: "19 listopada" });
    expect(within(komorka).getAllByTestId("kropka-kategorii")).toHaveLength(1);
    await userEvent.click(komorka);
    expect(screen.queryByText("Brak bloków — dodaj")).toBeNull();
    expect(screen.getByRole("link", { name: /Push/ })).toHaveAttribute(
      "href",
      "/sport?miesiac=2026-11&wybrany=t:t1:2026-11-19",
    );
  });
});

describe("MCalendarMonth — kolejność wpisów dnia", () => {
  it("treningi stoją między blokami wg godziny i mają obwódkę fokusu", () => {
    // 12.11: blok „Siłownia” 10:00; trening 07:00 i plan 18:30
    wyrenderuj({
      sport: [
        trening({
          key: "s:a",
          date: "2026-11-12",
          startMin: 1110,
          title: "Push",
        }),
        trening({ key: "s:b", date: "2026-11-12", startMin: 420 }),
      ],
    });
    const lista = screen
      .getByRole("link", { name: "Otwórz dzień" })
      .closest("div.flex-col") as HTMLElement;
    const wpisy = [
      ...lista.querySelectorAll("a[data-planned], a[href^='/sport'], button"),
    ]
      .map((e) => e.textContent)
      .filter((t) => /Spokojny|Siłownia|Push/.test(t ?? ""));
    expect(wpisy).toEqual(["07:00Spokojny", "10:00Siłownia", "18:30Push"]);
    expect(screen.getByRole("link", { name: /Spokojny/ })).toHaveClass(
      "focus-visible:shadow-focus",
    );
  });

  it("odnowienie: szara kropka w komórce dnia, liczona do limitu 3 kropek", () => {
    wyrenderuj({
      renewals: [
        odnowienie({ date: "2026-11-10", key: "f-ren:r1:2026-11-10" }),
        odnowienie({ date: "2026-11-20", key: "f-ren:r1:2026-11-20" }),
      ],
    });
    // 10.11 ma 4 kategorie: 2 kropki kategorii + kropka odnowienia = 3
    const z4 = screen.getByRole("button", { name: "10 listopada" });
    expect(within(z4).getAllByTestId("kropka-kategorii")).toHaveLength(2);
    expect(within(z4).getAllByTestId("kropka-odnowienia")).toHaveLength(1);
    // 20.11 ma tylko odnowienie
    const sam = screen.getByRole("button", { name: "20 listopada" });
    expect(within(sam).queryAllByTestId("kropka-kategorii")).toHaveLength(0);
    expect(within(sam).getByTestId("kropka-odnowienia")).toHaveStyle({ borderColor: "#737373" });
    // Dzień bez odnowienia nie ma kropki
    expect(within(screen.getByRole("button", { name: "12 listopada" })).queryByTestId("kropka-odnowienia")).toBeNull();
  });

  it("lista wybranego dnia zaczyna się od „↻ Nazwa · kwota”, a stuknięcie woła onRenewalClick; bez „Brak bloków — dodaj”", async () => {
    const onRenewalClick = vi.fn();
    wyrenderuj({
      date: "2026-11-20",
      renewals: [odnowienie({ date: "2026-11-20", key: "f-ren:r1:2026-11-20" })],
      onRenewalClick,
    });
    const wpis = screen.getByRole("button", { name: /↻ Netflix · 43,00 zł/ });
    expect(wpis).toHaveTextContent("cały dzień");
    expect(wpis).toHaveClass("border-dashed");
    expect(screen.queryByRole("button", { name: "Brak bloków — dodaj" })).toBeNull();
    await userEvent.click(wpis);
    expect(onRenewalClick).toHaveBeenCalledWith("f-ren:r1:2026-11-20");
  });
});
