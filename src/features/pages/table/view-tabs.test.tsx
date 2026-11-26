import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ViewTabs } from "./view-tabs";

// Zakładki jak w S2Books: „Wszystkie 11”, „Czytam 2”, „Do przeczytania 2”, „Przeczytane w 2026 6”
const ZAKLADKI = [
  { id: null, name: "Wszystkie", count: 11 },
  { id: "w1", name: "Czytam", count: 2 },
  { id: "w2", name: "Do przeczytania", count: 2 },
  { id: "w3", name: "Przeczytane w 2026", count: 6 },
];

function renderuj(activeId: string | null = null) {
  const wywolania = {
    onSelect: vi.fn(),
    onAdd: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };
  render(<ViewTabs tabs={ZAKLADKI} activeId={activeId} {...wywolania} />);
  return wywolania;
}

describe("ViewTabs", () => {
  it("zakładki z liczbami wierszy; aktywna ma aria-pressed", () => {
    renderuj("w1");
    const grupa = screen.getByRole("group", { name: "Zapisane widoki" });
    const przyciski = within(grupa).getAllByRole("button", { pressed: false }).concat(
      within(grupa).getAllByRole("button", { pressed: true }),
    );
    expect(przyciski.map((b) => b.textContent)).toEqual(
      expect.arrayContaining(["Wszystkie 11", "Czytam 2", "Do przeczytania 2", "Przeczytane w 2026 6"]),
    );
    expect(within(grupa).getByRole("button", { name: "Czytam 2" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupa).getByRole("button", { name: "Wszystkie 11" })).toHaveAttribute("aria-pressed", "false");
  });

  it("klik w zakładkę wybiera widok; „Wszystkie” to null", async () => {
    const user = userEvent.setup();
    const w = renderuj("w1");
    await user.click(screen.getByRole("button", { name: "Do przeczytania 2" }));
    expect(w.onSelect).toHaveBeenCalledWith("w2");
    await user.click(screen.getByRole("button", { name: "Wszystkie 11" }));
    expect(w.onSelect).toHaveBeenCalledWith(null);
  });

  it("„Widok” dodaje nowy widok", async () => {
    const user = userEvent.setup();
    const w = renderuj();
    await user.click(screen.getByRole("button", { name: "Widok" }));
    expect(w.onAdd).toHaveBeenCalledTimes(1);
  });

  it("menu widoku tylko przy aktywnym zapisanym widoku: Zmień nazwę, Duplikuj widok, Usuń widok", async () => {
    const user = userEvent.setup();
    const w = renderuj("w1");
    expect(screen.queryByRole("button", { name: "Menu widoku Wszystkie" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Menu widoku Do przeczytania" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Menu widoku Czytam" }));
    const menu = screen.getByRole("menu", { name: "Menu widoku Czytam" });
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
      "Zmień nazwę",
      "Duplikuj widok",
      "Usuń widok",
    ]);
    await user.click(within(menu).getByRole("menuitem", { name: "Duplikuj widok" }));
    expect(w.onDuplicate).toHaveBeenCalledWith("w1");

    await user.click(screen.getByRole("button", { name: "Menu widoku Czytam" }));
    await user.click(screen.getByRole("menuitem", { name: "Usuń widok" }));
    expect(w.onDelete).toHaveBeenCalledWith("w1");
  });

  it("„Zmień nazwę”: pole „Nazwa widoku”, Enter zapisuje, Esc anuluje", async () => {
    const user = userEvent.setup();
    const w = renderuj("w1");
    await user.click(screen.getByRole("button", { name: "Menu widoku Czytam" }));
    await user.click(screen.getByRole("menuitem", { name: "Zmień nazwę" }));
    const pole = await screen.findByRole("textbox", { name: "Nazwa widoku" });
    expect(pole).toHaveValue("Czytam");
    await user.clear(pole);
    await user.type(pole, "Czytam teraz{Enter}");
    expect(w.onRename).toHaveBeenCalledWith("w1", "Czytam teraz");
    expect(screen.queryByRole("textbox", { name: "Nazwa widoku" })).not.toBeInTheDocument();

    // Podwójne kliknięcie zakładki też zmienia nazwę; Esc nic nie zapisuje
    await user.dblClick(screen.getByRole("button", { name: "Czytam 2" }));
    const drugie = screen.getByRole("textbox", { name: "Nazwa widoku" });
    await user.type(drugie, "x{Escape}");
    expect(w.onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox", { name: "Nazwa widoku" })).not.toBeInTheDocument();
  });

  it("„Wszystkich” nie da się przemianować podwójnym kliknięciem", async () => {
    const user = userEvent.setup();
    renderuj();
    await user.dblClick(screen.getByRole("button", { name: "Wszystkie 11" }));
    expect(screen.queryByRole("textbox", { name: "Nazwa widoku" })).not.toBeInTheDocument();
  });
});
