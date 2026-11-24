import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { setHabitReminder } = vi.hoisted(() => ({ setHabitReminder: vi.fn() }));
vi.mock("./actions", () => ({ setHabitReminder }));

import { HabitRemindersCard } from "./habit-reminders-card";

const NAWYKI = [
  { id: "w", name: "Woda 2 l", schedule: "codziennie", remindAt: "12:00" },
  { id: "s", name: "Rozciąganie", schedule: "pn, śr, pt, nd", remindAt: null },
  { id: "e", name: "Angielski", schedule: "4× w tygodniu", remindAt: "18:00" },
];

describe("HabitRemindersCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setHabitReminder.mockResolvedValue({ ok: true });
  });

  it("podpisy harmonogramów, godzina przy włączonym, „wyłączone” przy null", () => {
    render(<HabitRemindersCard habits={NAWYKI} disabled={false} />);
    expect(screen.getByText("codziennie")).toBeInTheDocument();
    expect(screen.getByText("pn, śr, pt, nd")).toBeInTheDocument();
    expect(screen.getByText("4× w tygodniu")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Woda 2 l — godzina przypomnienia" }),
    ).toHaveTextContent("12:00");
    expect(
      screen.queryByRole("button", { name: "Rozciąganie — godzina przypomnienia" }),
    ).toBeNull();
    expect(screen.getAllByText("wyłączone")).toHaveLength(1);
    expect(
      screen.getByRole("switch", { name: "Przypomnienie: Rozciąganie" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  it("włączenie ustawia 20:30, wyłączenie null", async () => {
    render(<HabitRemindersCard habits={NAWYKI} disabled={false} />);
    fireEvent.click(screen.getByRole("switch", { name: "Przypomnienie: Rozciąganie" }));
    expect(setHabitReminder).toHaveBeenCalledWith("s", "20:30");
    expect(
      screen.getByRole("button", { name: "Rozciąganie — godzina przypomnienia" }),
    ).toHaveTextContent("20:30");
    fireEvent.click(screen.getByRole("switch", { name: "Przypomnienie: Woda 2 l" }));
    await waitFor(() => expect(setHabitReminder).toHaveBeenLastCalledWith("w", null));
  });

  it("zmiana godziny zapisuje nową wartość", async () => {
    render(<HabitRemindersCard habits={NAWYKI} disabled={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Angielski — godzina przypomnienia" }));
    fireEvent.click(await screen.findByRole("button", { name: "19" }));
    expect(setHabitReminder).toHaveBeenCalledWith("e", "19:00");
  });

  it("błąd zapisu cofa i pokazuje komunikat", async () => {
    setHabitReminder.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    render(<HabitRemindersCard habits={NAWYKI} disabled={false} />);
    const sw = screen.getByRole("switch", { name: "Przypomnienie: Rozciąganie" });
    fireEvent.click(sw);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(sw).toHaveAttribute("aria-checked", "false");
  });

  it("wyszarzone: aria-disabled, wszystkie „wyłączone”, bez zapisu", () => {
    render(<HabitRemindersCard habits={NAWYKI} disabled />);
    const sw = screen.getByRole("switch", { name: "Przypomnienie: Woda 2 l" });
    expect(sw).toHaveAttribute("aria-disabled", "true");
    expect(sw).toHaveAttribute("aria-checked", "false");
    expect(screen.getAllByText("wyłączone")).toHaveLength(3);
    fireEvent.click(sw);
    expect(setHabitReminder).not.toHaveBeenCalled();
  });

  it("brak nawyków → tekst i link do Nawyków", () => {
    render(<HabitRemindersCard habits={[]} disabled={false} />);
    expect(screen.getByText(/Nie masz jeszcze nawyków\./)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Przejdź do Nawyków" })).toHaveAttribute(
      "href",
      "/nawyki",
    );
  });
});
