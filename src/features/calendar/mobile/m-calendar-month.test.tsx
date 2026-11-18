import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { buildMonthGrid } from "@/components/controls/calendar-math";
import { kategoria, wystapienie } from "./fixtures";
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
    ).toContain("bg-[#171717]");
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

  it("nagłówki dni tygodnia zależą od początku tygodnia", () => {
    wyrenderuj();
    expect(screen.getByText("pn")).toBeInTheDocument();
  });
});
