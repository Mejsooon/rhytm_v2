import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { kategoria, wystapienie } from "./fixtures";
import { MCalendarDay } from "./m-calendar-day";

const kategorie = [kategoria("c1", "Studia", "#0070f3")];
// Środa 18.11.2026; tydzień pn 16.11 – nd 22.11
const wystapienia = [
  wystapienie("b1:2026-11-18", "2026-11-18", 600, 120, "Algebra", "c1"),
  wystapienie("b2:2026-11-20", "2026-11-20", 540, 60, "Siłownia", null),
];

function wyrenderuj(over: Partial<React.ComponentProps<typeof MCalendarDay>> = {}) {
  return render(
    <MCalendarDay
      date="2026-11-18"
      today="2026-11-17"
      weekStart="mon"
      nowMinutes={600}
      occurrences={wystapienia}
      categories={kategorie}
      clock="24"
      onAdd={() => {}}
      onBlockClick={() => {}}
      {...over}
    />,
  );
}

describe("MCalendarDay", () => {
  it("pasek tygodnia ma kropkę tylko przy dniach z blokami", () => {
    wyrenderuj();
    expect(screen.getByTestId("kropka-2026-11-18")).toBeInTheDocument();
    expect(screen.getByTestId("kropka-2026-11-20")).toBeInTheDocument();
    expect(screen.queryByTestId("kropka-2026-11-17")).toBeNull();
    expect(screen.getAllByRole("link", { name: /listopada$/ })).toHaveLength(7);
  });

  it("dzień z paska to link do widoku dnia, wybrany ma aria-current", () => {
    wyrenderuj();
    const link = screen.getByRole("link", { name: "Piątek 20 listopada" });
    expect(link).toHaveAttribute("href", "/kalendarz?widok=dzien&data=2026-11-20");
    expect(screen.getByRole("link", { name: "Środa 18 listopada" })).toHaveAttribute("aria-current", "date");
  });

  it("tytuł dnia z liczbą bloków", () => {
    wyrenderuj();
    expect(screen.getByText("Środa, 18 listopada · 1 blok")).toBeInTheDocument();
  });

  it("blok pokazuje godziny i kategorię, bez data-occurrence-key", () => {
    const { container } = wyrenderuj();
    expect(screen.getByRole("button", { name: /Algebra/ })).toHaveTextContent("10:00–12:00 · Studia");
    expect(container.querySelector("[data-occurrence-key]")).toBeNull();
  });

  it("blok stoi na 56 px na godzinę", () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /Algebra/ });
    expect(blok.style.top).toBe(`${10 * 56 + 1}px`);
    expect(blok.style.height).toBe(`${2 * 56 - 4}px`);
  });

  it("stuknięcie bloku woła onBlockClick z kluczem", async () => {
    const onBlockClick = vi.fn();
    wyrenderuj({ onBlockClick });
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(onBlockClick).toHaveBeenCalledWith("b1:2026-11-18");
  });

  it("stuknięcie pustej osi o 10:00 woła onAdd z tą godziną", () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    fireEvent.click(screen.getByRole("button", { name: "Dodaj blok w wolnym miejscu" }), { clientY: 10 * 56 });
    expect(onAdd).toHaveBeenCalledWith("2026-11-18", 600);
  });

  it("pływający „+” dodaje blok na dzień", async () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "Dodaj blok" }));
    expect(onAdd).toHaveBeenCalledWith("2026-11-18", 540);
  });

  it("linia „teraz” tylko w dzisiejszym dniu", () => {
    const { unmount } = wyrenderuj({ date: "2026-11-17", today: "2026-11-17" });
    expect(screen.getByTestId("linia-teraz").style.top).toBe(`${(600 / 60) * 56}px`);
    unmount();
    wyrenderuj();
    expect(screen.queryByTestId("linia-teraz")).toBeNull();
  });

  it("oś startuje przewinięta do 07:00", () => {
    wyrenderuj();
    expect(screen.getByTestId("m-os-dnia").scrollTop).toBe(7 * 56);
  });

  it("w dzisiejszym dniu oś przewija do trwającego bloku", () => {
    wyrenderuj({
      date: "2026-11-18",
      today: "2026-11-18",
      nowMinutes: 630,
      occurrences: [wystapienia[0], wystapienie("b3:2026-11-18", "2026-11-18", 960, 60, "Bieg", null)],
    });
    expect(screen.getByTestId("m-os-dnia").scrollTop).toBe(Math.round((600 / 60) * 56 - 28));
  });

  it("niski blok (30 min) ma pole dotyku co najmniej 44 px", () => {
    wyrenderuj({
      occurrences: [wystapienie("b9:2026-11-18", "2026-11-18", 480, 30, "Rutyna", null)],
    });
    const blok = screen.getByRole("button", { name: /Rutyna/ });
    const wysokosc = parseFloat(blok.style.height);
    const obszar = screen.getByTestId("obszar-dotyku");
    const zapas = -parseFloat(obszar.style.top);
    expect(blok).toContainElement(obszar);
    expect(wysokosc + 2 * zapas).toBeGreaterThanOrEqual(44);
  });

  it("wysoki blok nie dostaje dodatkowego obszaru dotyku", () => {
    wyrenderuj();
    expect(screen.queryByTestId("obszar-dotyku")).toBeNull();
  });
});
