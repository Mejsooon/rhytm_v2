import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { EffectiveView } from "../table-views";
import { TableToolbar } from "./table-toolbar";
import { stronaTestowa } from "./test-page";

const POLA = stronaTestowa("books", "Książki", []).blocks[0].fields;
const pole = (nazwa: string) => POLA.find((f) => f.name === nazwa)!;

function renderuj(view: Partial<EffectiveView> = {}, query = "") {
  const wywolania = {
    onQuery: vi.fn(),
    onLayout: vi.fn(),
    onGroupBy: vi.fn(),
    onSort: vi.fn(),
    onHiddenChange: vi.fn(),
  };
  render(
    <TableToolbar
      fields={POLA}
      view={{ filters: [], sort: [], group_by: null, layout: "table", hidden_field_ids: [], ...view }}
      query={query}
      filter={<button type="button">Filtruj</button>}
      menu={<button type="button">Menu tabeli</button>}
      {...wywolania}
    />,
  );
  return wywolania;
}

describe("TableToolbar", () => {
  it("Tabela / Tablica: przełącznik układu z aria-pressed", async () => {
    const user = userEvent.setup();
    const w = renderuj();
    const typ = screen.getByRole("group", { name: "Typ widoku" });
    expect(within(typ).getByRole("button", { name: "Tabela" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(typ).getByRole("button", { name: "Tablica" }));
    expect(w.onLayout).toHaveBeenCalledWith("board");
  });

  it("„Grupuj: Status” i menu „Grupuj według” z „Bez grupowania” i polami wyboru", async () => {
    const user = userEvent.setup();
    const w = renderuj({ group_by: pole("Status").id });
    await user.click(screen.getByRole("button", { name: "Grupuj: Status" }));
    const menu = screen.getByRole("menu", { name: "Grupuj według" });
    const pozycje = within(menu).getAllByRole("menuitemradio");
    expect(pozycje.map((p) => p.textContent)).toEqual(["Bez grupowania", "Status"]);
    expect(pozycje[1]).toHaveAttribute("aria-checked", "true");
    await user.click(pozycje[0]);
    expect(w.onGroupBy).toHaveBeenCalledWith(null);
  });

  it("bez grupowania przycisk to „Grupuj”", () => {
    renderuj();
    expect(screen.getByRole("button", { name: "Grupuj" })).toBeInTheDocument();
  });

  it("sortowanie: etykieta „Przeczytana ↓” (klucz poza polem grupowania), wybór pola i kierunku", async () => {
    const user = userEvent.setup();
    const w = renderuj({
      group_by: pole("Status").id,
      sort: [
        { field_id: pole("Status").id, dir: "asc" },
        { field_id: pole("Przeczytana").id, dir: "desc" },
      ],
    });
    await user.click(screen.getByRole("button", { name: "Przeczytana ↓" }));
    const menu = screen.getByRole("menu", { name: "Sortuj" });
    expect(within(menu).getByRole("menuitemradio", { name: "Przeczytana" })).toHaveAttribute("aria-checked", "true");
    await user.click(within(menu).getByRole("button", { name: "Rosnąco" }));
    expect(w.onSort).toHaveBeenLastCalledWith([
      { field_id: pole("Status").id, dir: "asc" },
      { field_id: pole("Przeczytana").id, dir: "asc" },
    ]);
    await user.click(within(screen.getByRole("menu", { name: "Sortuj" })).getByRole("menuitemradio", { name: "Autor" }));
    expect(w.onSort).toHaveBeenLastCalledWith([{ field_id: pole("Autor").id, dir: "desc" }]);
  });

  it("bez sortowania przycisk to „Sortuj”", () => {
    renderuj();
    expect(screen.getByRole("button", { name: "Sortuj" })).toBeInTheDocument();
  });

  it("Pola: lista „Widoczne pola”, tytuł zablokowany, odznaczenie ukrywa pole; plakietka „1 ukryte”", async () => {
    const user = userEvent.setup();
    const w = renderuj({ hidden_field_ids: [pole("Ocena").id] });
    await user.click(screen.getByRole("button", { name: /^Pola/ }));
    expect(screen.getByRole("button", { name: /^Pola/ })).toHaveTextContent("Pola1 ukryte");
    const okno = screen.getByRole("dialog", { name: "Widoczne pola" });
    expect(within(okno).getByRole("checkbox", { name: "Tytuł" })).toBeDisabled();
    expect(within(okno).getByRole("checkbox", { name: "Ocena" })).not.toBeChecked();
    await user.click(within(okno).getByRole("checkbox", { name: "Autor" }));
    expect(w.onHiddenChange).toHaveBeenLastCalledWith([pole("Ocena").id, pole("Autor").id]);
    await user.click(within(okno).getByRole("checkbox", { name: "Ocena" }));
    expect(w.onHiddenChange).toHaveBeenLastCalledWith([]);
  });

  it("szukajka przekazuje frazę", async () => {
    const user = userEvent.setup();
    const w = renderuj();
    await user.type(screen.getByRole("searchbox", { name: "Szukaj" }), "a");
    expect(w.onQuery).toHaveBeenCalledWith("a");
  });

  it("filtr i menu „⋯” z gniazd", () => {
    renderuj();
    expect(screen.getByRole("button", { name: "Filtruj" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Menu tabeli" })).toBeInTheDocument();
  });
});
