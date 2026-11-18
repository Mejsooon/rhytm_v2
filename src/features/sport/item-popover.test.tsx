import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ItemPopover } from "./item-popover";
import type { SportItem } from "./model";
import { daneSportu, SESJA_PUSH, SZABLON_PUSH } from "./sport-test-data";

function wyrenderuj(klucz: string, zmiany: Partial<SportItem> = {}) {
  const dane = daneSportu();
  const item = {
    ...(dane.items.find((i) => i.key === klucz) as SportItem),
    ...zmiany,
  };
  const wlasciwosci = {
    item,
    openLeft: false,
    openUp: false,
    clock: "24" as const,
    templates: dane.templates,
    exercises: dane.exercises,
    setsHistory: dane.setsHistory,
    onClose: vi.fn(),
    onOpenRun: vi.fn(),
    onStartGym: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<ItemPopover {...wlasciwosci} />);
  return { ...wlasciwosci, dymek: screen.getByRole("dialog") };
}

// Wartość statystyki po jej etykiecie
function statystyka(dymek: HTMLElement, etykieta: string) {
  return within(dymek).getByText(etykieta).nextElementSibling?.textContent;
}

describe("ItemPopover", () => {
  it("bieg wykonany: Dystans / Czas / Tempo / Kcal / Trudność / Godzina i „Edytuj”", async () => {
    const w = wyrenderuj("s:a1000000-0000-4000-8000-000000000015");
    expect(w.dymek).toHaveTextContent("BIEG");
    expect(w.dymek).toHaveTextContent("wykonany · w kalendarzu");
    expect(w.dymek).toHaveTextContent("Długi bieg");
    expect(w.dymek).toHaveTextContent("nd 15.11.2026 · 09:00–10:10");
    expect(statystyka(w.dymek, "Dystans")).toBe("12,0 km");
    expect(statystyka(w.dymek, "Czas")).toBe("1:10:12");
    expect(statystyka(w.dymek, "Tempo")).toBe("5:51 /km");
    expect(statystyka(w.dymek, "Kcal")).toBe("≈ 912");
    expect(statystyka(w.dymek, "Trudność")).toBe("7/10");
    expect(statystyka(w.dymek, "Godzina")).toBe("09:00");
    expect(w.dymek).toHaveTextContent("Ostatnie 2 km mocniej, nogi dobrze.");

    await userEvent.click(
      within(w.dymek).getByRole("button", { name: "Edytuj" }),
    );
    expect(w.onOpenRun).toHaveBeenCalledWith({
      sessionId: "a1000000-0000-4000-8000-000000000015",
    });
  });

  it("bieg bez kcal i trudności pokazuje „—”", () => {
    const w = wyrenderuj("s:a1000000-0000-4000-8000-000000000015", {
      kcal: null,
      difficulty: null,
    });
    expect(statystyka(w.dymek, "Kcal")).toBe("—");
    expect(statystyka(w.dymek, "Trudność")).toBe("—");
  });

  it("bieg zaplanowany: Plan / Start i „Uzupełnij dane”", async () => {
    const w = wyrenderuj("s:a1000000-0000-4000-8000-000000000017");
    expect(w.dymek).toHaveTextContent("zaplanowany");
    expect(statystyka(w.dymek, "Plan")).toBe("10 km");
    expect(statystyka(w.dymek, "Start")).toBe("16:00");
    await userEvent.click(
      within(w.dymek).getByRole("button", { name: "Uzupełnij dane" }),
    );
    expect(w.onOpenRun).toHaveBeenCalled();
  });

  it("trening siłowy wykonany: statystyki, najlepsze serie, rekordy i „Otwórz trening”", () => {
    const w = wyrenderuj(`s:${SESJA_PUSH}`);
    expect(w.dymek).toHaveTextContent("SIŁA");
    expect(statystyka(w.dymek, "Ćwiczenia")).toBe("2");
    expect(statystyka(w.dymek, "Serie")).toBe("3 / 3");
    expect(statystyka(w.dymek, "Objętość")).toBe("652,5 kg");
    expect(statystyka(w.dymek, "Czas")).toBe("1:30:00");
    expect(statystyka(w.dymek, "Trudność")).toBe("8/10");
    expect(statystyka(w.dymek, "Rekordy")).toBe("1");
    expect(w.dymek).toHaveTextContent("Wyciskanie na ławce72,5 × 5");
    expect(w.dymek).toHaveTextContent("Pompki na poręczachmc × 10");
    expect(
      within(w.dymek).getByRole("link", { name: "Otwórz trening" }),
    ).toHaveAttribute("href", `/sport/trening/${SESJA_PUSH}`);
  });

  it("plan z szablonu: Szablon / Start / Ćwiczenia / Serie, „jak ostatnio” i „Rozpocznij”", async () => {
    const w = wyrenderuj(`t:${SZABLON_PUSH}:2026-11-19`);
    expect(statystyka(w.dymek, "Szablon")).toBe("Push");
    expect(statystyka(w.dymek, "Start")).toBe("15:00");
    expect(statystyka(w.dymek, "Ćwiczenia")).toBe("2");
    expect(statystyka(w.dymek, "Serie")).toBe("7");
    expect(within(w.dymek).getAllByText("jak ostatnio")).toHaveLength(2);
    await userEvent.click(
      within(w.dymek).getByRole("button", { name: "Rozpocznij" }),
    );
    expect(w.onStartGym).toHaveBeenCalledWith({
      date: "2026-11-19",
      start: "15:00",
      templateId: SZABLON_PUSH,
    });
  });

  it("„Usuń” i ✕", async () => {
    const w = wyrenderuj("s:a1000000-0000-4000-8000-000000000015");
    await userEvent.click(
      within(w.dymek).getByRole("button", { name: "Usuń" }),
    );
    expect(w.onDelete).toHaveBeenCalledWith(w.item);
    await userEvent.click(
      within(w.dymek).getByRole("button", { name: "Zamknij" }),
    );
    expect(w.onClose).toHaveBeenCalled();
  });

  it("bez „w kalendarzu”, gdy trening nie jest pokazywany w kalendarzu", () => {
    const w = wyrenderuj("s:a1000000-0000-4000-8000-000000000015", {
      showInCalendar: false,
    });
    expect(w.dymek).not.toHaveTextContent("w kalendarzu");
  });
});
