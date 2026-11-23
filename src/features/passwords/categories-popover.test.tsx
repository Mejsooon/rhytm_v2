import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CategoriesPopover } from "./categories-popover";

const OPCJE = [
  { id: "k1", label: "Praca", color: "#525252" },
  { id: "k2", label: "Studia", color: "#525252" },
];

describe("CategoriesPopover", () => {
  const onCreate = vi.fn();
  const onRemove = vi.fn();
  beforeEach(() => vi.clearAllMocks());

  it("zamknięty dymek: tylko przycisk „Kategorie”", () => {
    render(<CategoriesPopover options={OPCJE} readOnly={false} onCreate={onCreate} onRemove={onRemove} />);
    expect(screen.getByRole("button", { name: "Kategorie" })).toBeEnabled();
    expect(screen.queryByText("Opcje kategorii")).not.toBeInTheDocument();
  });

  it("dymek „Opcje kategorii”: lista „Kategorie haseł” z „×”, pole „Nowa kategoria” i „Dodaj”", async () => {
    const user = userEvent.setup();
    render(<CategoriesPopover options={OPCJE} readOnly={false} onCreate={onCreate} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    expect(screen.getByRole("dialog", { name: "Opcje kategorii" })).toBeInTheDocument();
    const lista = screen.getByRole("list", { name: "Kategorie haseł" });
    expect(within(lista).getAllByRole("listitem")).toHaveLength(2);
    expect(within(lista).getByText("Praca")).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Nowa kategoria" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dodaj" })).toBeInTheDocument();
  });

  it("„Dodaj” woła onCreate z przyciętą etykietą i czyści pole; Enter też; puste nic nie robi", async () => {
    const user = userEvent.setup();
    render(<CategoriesPopover options={OPCJE} readOnly={false} onCreate={onCreate} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    const pole = screen.getByRole("textbox", { name: "Nowa kategoria" });
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(onCreate).not.toHaveBeenCalled();
    await user.type(pole, "  Prywatne ");
    await user.click(screen.getByRole("button", { name: "Dodaj" }));
    expect(onCreate).toHaveBeenCalledWith("Prywatne");
    expect(pole).toHaveValue("");
    await user.type(pole, "Bank{Enter}");
    expect(onCreate).toHaveBeenLastCalledWith("Bank");
  });

  it("„×” woła onRemove z id opcji", async () => {
    const user = userEvent.setup();
    render(<CategoriesPopover options={OPCJE} readOnly={false} onCreate={onCreate} onRemove={onRemove} />);
    await user.click(screen.getByRole("button", { name: "Kategorie" }));
    await user.click(screen.getByRole("button", { name: "Usuń kategorię Studia" }));
    expect(onRemove).toHaveBeenCalledWith("k2");
  });

  it("zamknięty sejf: przycisk wyłączony, dymek się nie otwiera", async () => {
    const user = userEvent.setup();
    render(<CategoriesPopover options={OPCJE} readOnly onCreate={onCreate} onRemove={onRemove} />);
    const przycisk = screen.getByRole("button", { name: "Kategorie" });
    expect(przycisk).toBeDisabled();
    await user.click(przycisk);
    expect(screen.queryByText("Opcje kategorii")).not.toBeInTheDocument();
  });
});
