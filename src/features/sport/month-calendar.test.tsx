import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MonthCalendar } from "./month-calendar";
import { daneSportu, SZABLON_PUSH } from "./sport-test-data";

function wyrenderuj(zmiany: Partial<Parameters<typeof MonthCalendar>[0]> = {}) {
  const dane = daneSportu();
  const wlasciwosci = {
    data: dane,
    items: dane.items,
    selectedKey: null,
    addDate: null,
    onSelect: vi.fn(),
    onAddDay: vi.fn(),
    onOpenRun: vi.fn(),
    onStartGym: vi.fn(),
    onDelete: vi.fn(),
    ...zmiany,
  };
  render(<MonthCalendar {...wlasciwosci} />);
  return wlasciwosci;
}

describe("MonthCalendar", () => {
  it("nagłówek dni wg początku tygodnia i kolumna „Σ tydz.”", () => {
    wyrenderuj();
    expect(screen.getByText("Σ tydz.")).toBeInTheDocument();
    const naglowek = screen.getByTestId("naglowek-dni");
    expect(naglowek.textContent).toBe("ponwtśrczwptsobndΣ tydz.");
  });

  it("„Σ tydz.” pokazuje km wykonanych biegów i „N tr.” wiersza", () => {
    wyrenderuj();
    // Wiersz 9–15.11: interwały 6,4 km + długi 12 km + Push
    const wiersz = screen.getByTestId("suma-2026-11-09");
    expect(wiersz).toHaveTextContent("18,4 km");
    expect(wiersz).toHaveTextContent("3 tr.");
    // Wiersz 16–22.11: same plany → „—” i brak licznika
    const plany = screen.getByTestId("suma-2026-11-16");
    expect(plany).toHaveTextContent("—");
    expect(plany).not.toHaveTextContent("tr.");
  });

  it("chipy: bieg wykonany z km, plan przerywany, trening siłowy z nazwą", () => {
    wyrenderuj();
    const wykonany = screen.getByRole("button", {
      name: "Długi bieg, nd 15.11",
    });
    expect(wykonany).toHaveTextContent("● 12,0");
    const plan = screen.getByRole("button", { name: "Spokojny, wt 17.11" });
    expect(plan).toHaveTextContent("● 10 km");
    expect(plan.style.border).toContain("dashed");
    expect(
      screen.getByRole("button", { name: "Push, czw 12.11" }),
    ).toHaveTextContent("■ Push");
  });

  it("klik w trening wybiera jego klucz", async () => {
    const w = wyrenderuj();
    await userEvent.click(
      screen.getByRole("button", { name: "Długi bieg, nd 15.11" }),
    );
    expect(w.onSelect).toHaveBeenCalledWith(
      "s:a1000000-0000-4000-8000-000000000015",
    );
  });

  it("dymek w lewej kolumnie górnego wiersza otwiera się w prawo i w dół", () => {
    wyrenderuj({ selectedKey: "s:a1000000-0000-4000-8000-000000000010" });
    const dymek = screen.getByRole("dialog", { name: "Interwały" });
    expect(dymek.className).toContain("left-[calc(100%+6px)]");
    expect(dymek.className).toContain("top-0");
  });

  it("dymek w prawej kolumnie otwiera się w lewo, a w dolnym wierszu w górę", () => {
    // nd 29.11: wiersz 4, kolumna 6
    wyrenderuj({ selectedKey: "s:a1000000-0000-4000-8000-000000000029" });
    const dymek = screen.getByRole("dialog", { name: "Spokojny" });
    expect(dymek.className).toContain("right-[calc(100%+6px)]");
    expect(dymek.className).toContain("bottom-0");
  });

  it("klik w pusty dzień prosi o dymek „Dodaj trening”", async () => {
    const w = wyrenderuj();
    await userEvent.click(screen.getByTestId("dzien-2026-11-18"));
    expect(w.onAddDay).toHaveBeenCalledWith("2026-11-18");
  });

  it("dymek „Dodaj trening”: Bieg / Siłownia / „Z szablonu”", async () => {
    const w = wyrenderuj({ addDate: "2026-11-18" });
    const dymek = screen.getByRole("dialog", { name: "Dodaj trening" });
    expect(dymek).toHaveTextContent("śr 18.11");
    expect(dymek).toHaveTextContent("Z szablonu");

    await userEvent.click(within(dymek).getByRole("button", { name: /Bieg/ }));
    expect(w.onOpenRun).toHaveBeenCalledWith(
      expect.objectContaining({ date: "2026-11-18" }),
    );
    await userEvent.click(
      within(dymek).getByRole("button", { name: /Siłownia/ }),
    );
    expect(w.onStartGym).toHaveBeenLastCalledWith({
      date: "2026-11-18",
      start: expect.stringMatching(/^\d\d:(00|15|30|45)$/),
    });
    await userEvent.click(within(dymek).getByRole("button", { name: "Push" }));
    expect(w.onStartGym).toHaveBeenLastCalledWith(
      expect.objectContaining({ date: "2026-11-18", templateId: SZABLON_PUSH }),
    );
  });

  it("dni spoza miesiąca nie mają „+”", () => {
    wyrenderuj();
    expect(
      screen.queryByRole("button", { name: "Dodaj trening, pon 26.10" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Dodaj trening, śr 18.11" }),
    ).toBeInTheDocument();
  });
});
