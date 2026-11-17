import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCategory, updateCategory } = vi.hoisted(() => ({ createCategory: vi.fn(), updateCategory: vi.fn() }));
vi.mock("./actions", () => ({ createCategory, updateCategory }));

import { CategoryDialog } from "./category-dialog";

beforeEach(() => vi.clearAllMocks());

describe("CategoryDialog", () => {
  it("pusta nazwa blokuje „Dodaj kategorię”", () => {
    render(<CategoryDialog onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Dodaj kategorię" })).toBeDisabled();
  });

  it("zapisuje nazwę z wybranym kolorem i oddaje kategorię", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "k9" });
    const onSaved = vi.fn();
    render(<CategoryDialog usedColors={["#0070f3"]} onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nazwa"), "Języki");
    await userEvent.click(screen.getByRole("button", { name: "Fioletowy" }));
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kategorię" }));
    expect(createCategory).toHaveBeenCalledWith({ name: "Języki", color: "#7c3aed" });
    expect(onSaved).toHaveBeenCalledWith({ id: "k9", name: "Języki", color: "#7c3aed" });
  });

  it("domyślnie wybiera pierwszy wolny kolor, zajęty zostaje do wyboru", async () => {
    render(<CategoryDialog usedColors={["#0070f3"]} onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Zielony" })).toHaveAttribute("aria-pressed", "true");
    await userEvent.click(screen.getByRole("button", { name: "Niebieski" }));
    expect(screen.getByRole("button", { name: "Niebieski" })).toHaveAttribute("aria-pressed", "true");
  });

  it("błąd akcji pokazuje komunikat i nie zamyka okna", async () => {
    createCategory.mockResolvedValue({ ok: false, message: "Nazwa zajęta." });
    const onSaved = vi.fn();
    render(<CategoryDialog onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nazwa"), "Dom");
    await userEvent.click(screen.getByRole("button", { name: "Dodaj kategorię" }));
    expect(await screen.findByText("Nazwa zajęta.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("Anuluj i ✕ wołają onCancel", async () => {
    const onCancel = vi.fn();
    render(<CategoryDialog onSaved={vi.fn()} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("tryb edycji: tytuł „Edytuj kategorię”, wartości kategorii i zapis przez updateCategory", async () => {
    updateCategory.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(
      <CategoryDialog category={{ id: "k1", name: "Nauka", color: "#0070f3" }} onSaved={onSaved} onCancel={vi.fn()} />,
    );
    expect(screen.getByText("Edytuj kategorię")).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa")).toHaveValue("Nauka");
    await userEvent.click(screen.getByRole("button", { name: "Fioletowy" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(updateCategory).toHaveBeenCalledWith({ id: "k1", name: "Nauka", color: "#7c3aed" });
    expect(createCategory).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({ id: "k1", name: "Nauka", color: "#7c3aed" });
  });
});
