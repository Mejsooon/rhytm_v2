import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveSleepLog } = vi.hoisted(() => ({ saveSleepLog: vi.fn() }));
vi.mock("../actions", () => ({ saveSleepLog }));

import type { IsoDate } from "@/components/controls/calendar-math";
import type { SleepLog } from "../sleep";
import { MSleepSheet } from "./m-sleep-sheet";

const LOGI: SleepLog[] = [
  { date: "2026-11-16", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: ["Trening"], note: "dobrze" },
];

function wyrenderuj(opcje: { date?: IsoDate; clock?: "24" | "12" } = {}) {
  const onDone = vi.fn();
  render(
    <MSleepSheet date={opcje.date ?? "2026-11-15"} logs={LOGI} goalMin={450} clock={opcje.clock ?? "24"} onDone={onDone} />,
  );
  return { onDone, okno: screen.getByRole("dialog", { name: "Wpis snu" }) };
}

beforeEach(() => vi.clearAllMocks());

describe("MSleepSheet", () => {
  it("nagłówek, tytuł nocy i domyślne 23:00 → 07:00", () => {
    const { okno } = wyrenderuj();
    expect(within(okno).getByRole("button", { name: "Anuluj" })).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeEnabled();
    expect(within(okno).getByText("Noc 14 → 15 listopada")).toBeInTheDocument();
    expect(within(okno).getByTestId("zasniecie")).toHaveTextContent("23:00");
    expect(within(okno).getByTestId("pobudka")).toHaveTextContent("07:00");
    expect(within(okno).getByText("8:00")).toBeInTheDocument();
    expect(within(okno).getByText("Powyżej celu 7:30")).toBeInTheDocument();
  });

  it("−/+ co 15 min, z przejściem przez północ", async () => {
    const { okno } = wyrenderuj();
    const pozniej = within(okno).getByRole("button", { name: "Zasnąłem później" });
    for (let i = 0; i < 5; i++) await userEvent.click(pozniej);
    // 23:00 + 75 min = 00:15
    expect(within(okno).getByTestId("zasniecie")).toHaveTextContent("00:15");
    expect(within(okno).getByText("6:45")).toBeInTheDocument();
    expect(within(okno).getByText("Brakuje 45 min do celu 7:30")).toBeInTheDocument();
    await userEvent.click(within(okno).getByRole("button", { name: "Wstałem wcześniej" }));
    expect(within(okno).getByTestId("pobudka")).toHaveTextContent("06:45");
    await userEvent.click(within(okno).getByRole("button", { name: "Zasnąłem wcześniej" }));
    await userEvent.click(within(okno).getByRole("button", { name: "Zasnąłem wcześniej" }));
    expect(within(okno).getByTestId("zasniecie")).toHaveTextContent("23:45");
  });

  it("dzień z wpisem edytuje ten wpis", () => {
    const { okno } = wyrenderuj({ date: "2026-11-16" });
    expect(within(okno).getByText("Noc 15 → 16 listopada")).toBeInTheDocument();
    expect(within(okno).getByTestId("zasniecie")).toHaveTextContent("23:48");
    expect(within(okno).getByText("7:12")).toBeInTheDocument();
    expect(within(okno).getByText("Brakuje 18 min do celu 7:30")).toBeInTheDocument();
    expect(within(okno).getByRole("radio", { name: "Jakość 4 — Dobrze" })).toHaveAttribute("aria-checked", "true");
    expect(within(okno).getByRole("button", { name: "Trening" })).toHaveAttribute("aria-pressed", "true");
    expect(within(okno).getByRole("textbox", { name: "Notatka" })).toHaveValue("dobrze");
  });

  it("„Jak się wyspałeś?” 1–5 z etykietami, tagi i notatka trafiają do zapisu", async () => {
    saveSleepLog.mockResolvedValue({ ok: true });
    const { okno, onDone } = wyrenderuj();
    const skala = within(okno).getByRole("radiogroup", { name: "Jak się wyspałeś?" });
    expect(within(skala).getAllByRole("radio").map((r) => r.textContent)).toEqual([
      "1Źle",
      "2Słabo",
      "3OK",
      "4Dobrze",
      "5Super",
    ]);
    await userEvent.click(within(okno).getByRole("radio", { name: "Jakość 5 — Super" }));
    await userEvent.click(within(okno).getByRole("button", { name: "Kawa po 16" }));
    await userEvent.type(within(okno).getByRole("textbox", { name: "Notatka" }), "późno");
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(saveSleepLog).toHaveBeenCalledWith({
      date: "2026-11-15",
      sleptAt: "23:00",
      wokeAt: "07:00",
      feeling: 5,
      tags: ["Kawa po 16"],
      note: "późno",
    });
    expect(onDone).toHaveBeenCalled();
  });

  it("równe godziny: brak czasu i Zapisz nieaktywne", async () => {
    const { okno } = wyrenderuj();
    // 07:00 → 23:00 to 64 kroki po 15 min w przód
    const pozniej = within(okno).getByRole("button", { name: "Wstałem później" });
    for (let i = 0; i < 64; i++) await userEvent.click(pozniej);
    expect(within(okno).getByText("Godziny zaśnięcia i pobudki muszą się różnić.")).toBeInTheDocument();
    expect(within(okno).getByRole("button", { name: "Zapisz" })).toBeDisabled();
  });

  it("w trakcie zapisu Anuluj i Esc zablokowane; błąd zostaje", async () => {
    let zakoncz!: (v: { ok: false; message: string }) => void;
    saveSleepLog.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const { okno, onDone } = wyrenderuj();
    await userEvent.click(within(okno).getByRole("button", { name: "Zapisz" }));
    expect(within(okno).getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onDone).not.toHaveBeenCalled();
    await act(async () => zakoncz({ ok: false, message: "Błąd" }));
    expect(within(okno).getByRole("alert")).toHaveTextContent("Błąd");
  });

  it("zegar 12 h", () => {
    const { okno } = wyrenderuj({ clock: "12" });
    expect(within(okno).getByTestId("zasniecie")).toHaveTextContent("11:00 PM");
  });
});
