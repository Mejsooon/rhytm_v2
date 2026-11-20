import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCategory, updateCategory } = vi.hoisted(() => ({
  createCategory: vi.fn(),
  updateCategory: vi.fn(),
}));
vi.mock("./actions", () => ({ createCategory, updateCategory }));

import { CategoryDialog } from "./category-dialog";

beforeEach(() => vi.clearAllMocks());

describe("CategoryDialog", () => {
  it("pusta nazwa blokuje „Dodaj kategorię”", () => {
    render(<CategoryDialog onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    ).toBeDisabled();
  });

  it("zapisuje nazwę z wybranym kolorem i oddaje kategorię", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "k9" });
    const onSaved = vi.fn();
    render(
      <CategoryDialog
        usedColors={["#0070f3"]}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.type(screen.getByLabelText("Nazwa"), "Języki");
    await userEvent.click(screen.getByRole("button", { name: "Fioletowy" }));
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    );
    expect(createCategory).toHaveBeenCalledWith({
      name: "Języki",
      color: "#7c3aed",
    });
    expect(onSaved).toHaveBeenCalledWith({
      id: "k9",
      name: "Języki",
      color: "#7c3aed",
    });
  });

  it("domyślnie wybiera pierwszy wolny kolor, zajęty zostaje do wyboru", async () => {
    render(
      <CategoryDialog
        usedColors={["#0070f3"]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Zielony" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Niebieski" }));
    expect(screen.getByRole("button", { name: "Niebieski" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("zajęty, niewybrany kolor blaknie tylko tłem, bez opacity (obrys fokusu pełny)", () => {
    render(
      <CategoryDialog
        usedColors={["#0e7490"]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const zajety = screen.getByRole("button", { name: "Morski" });
    expect(zajety.style.opacity).toBe("");
    expect(zajety.className).toContain("color-mix");
    expect(zajety).toHaveClass("focus-visible:outline-ring");
    const wolny = screen.getByRole("button", { name: "Niebieski" });
    expect(wolny.className).not.toContain("color-mix");
  });

  it("błąd akcji pokazuje komunikat i nie zamyka okna", async () => {
    createCategory.mockResolvedValue({ ok: false, message: "Nazwa zajęta." });
    const onSaved = vi.fn();
    render(<CategoryDialog onSaved={onSaved} onCancel={vi.fn()} />);
    await userEvent.type(screen.getByLabelText("Nazwa"), "Dom");
    await userEvent.click(
      screen.getByRole("button", { name: "Dodaj kategorię" }),
    );
    expect(await screen.findByText("Nazwa zajęta.")).toBeInTheDocument();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it("Anuluj i ✕ wołają onCancel", async () => {
    const onCancel = vi.fn();
    render(<CategoryDialog onSaved={vi.fn()} onCancel={onCancel} />);
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it("tryb edycji: tytuł „Edytuj kategorię”, wartości kategorii i zapis przez updateCategory", async () => {
    updateCategory.mockResolvedValue({ ok: true });
    const onSaved = vi.fn();
    render(
      <CategoryDialog
        category={{ id: "k1", name: "Nauka", color: "#0070f3" }}
        onSaved={onSaved}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Edytuj kategorię")).toBeInTheDocument();
    expect(screen.getByLabelText("Nazwa")).toHaveValue("Nauka");
    await userEvent.click(screen.getByRole("button", { name: "Fioletowy" }));
    await userEvent.click(screen.getByRole("button", { name: "Zapisz" }));
    expect(updateCategory).toHaveBeenCalledWith({
      id: "k1",
      name: "Nauka",
      color: "#7c3aed",
    });
    expect(createCategory).not.toHaveBeenCalled();
    expect(onSaved).toHaveBeenCalledWith({
      id: "k1",
      name: "Nauka",
      color: "#7c3aed",
    });
  });

  it("wygląd jak w CCategoryDialog: kolory 36 px z promieniem 10 px, podgląd bloku według reguły bloku", () => {
    render(
      <CategoryDialog
        category={{ id: "k1", name: "Języki", color: "#0e7490" }}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    const wybrany = screen.getByRole("button", { name: "Morski" });
    expect(wybrany).toHaveClass("size-9", "rounded-md", "border-2", "border-white");
    // Pierścień wybranego koloru w kolorze danych, fokus jako obrys poza nim
    expect(wybrany).toHaveClass(
      "shadow-[0_0_0_2px_var(--kolor)]",
      "focus-visible:outline-ring",
    );
    const blok = screen.getByText("Angielski").parentElement as HTMLElement;
    expect(blok.style.background).toBe("rgba(14, 116, 144, 0.07)");
    expect(blok.style.border).toBe("1px solid rgba(14, 116, 144, 0.3)");
    expect(blok.style.borderLeft).not.toContain("3px");
    expect(blok).toHaveClass("rounded-md", "px-3", "py-[7px]", "text-sm");
    // Podgląd w ramce .frame, chip w stanie wybranym z licznikiem jako odznaka
    expect(blok.parentElement).toHaveClass("rounded-lg", "border-[1.5px]", "p-3");
    expect(screen.getByText("0")).toHaveClass("bg-muted", "rounded-sm", "h-4");
  });
});
