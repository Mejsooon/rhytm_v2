import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createCategory } = vi.hoisted(() => ({ createCategory: vi.fn() }));
vi.mock("@/features/categories/actions", () => ({ createCategory }));

import { MCategorySheet } from "./m-category-sheet";

beforeEach(() => vi.clearAllMocks());

describe("MCategorySheet", () => {
  it("pusta nazwa blokuje „Dodaj”; błąd pojawia się po dotknięciu pola", async () => {
    render(<MCategorySheet onSaved={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: "Dodaj" })[0]).toBeDisabled();
    expect(screen.queryByText("Nazwa nie może być pusta.")).toBeNull();
    await userEvent.type(screen.getByRole("textbox", { name: "Nazwa" }), "A");
    await userEvent.clear(screen.getByRole("textbox", { name: "Nazwa" }));
    expect(screen.getByText("Nazwa nie może być pusta.")).toBeInTheDocument();
  });

  it("siatka 8 kolorów; domyślnie pierwszy wolny, zajęty wyblakły ale do wyboru", async () => {
    render(
      <MCategorySheet
        usedColors={["#0070f3"]}
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect(screen.getByRole("radio", { name: "Zielony" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    const zajety = screen.getByRole("radio", { name: "Niebieski" });
    expect(zajety).toHaveClass("opacity-50");
    await userEvent.click(zajety);
    expect(zajety).toHaveAttribute("aria-checked", "true");
    expect(zajety).not.toHaveClass("opacity-50");
  });

  it("kolory: strzałki zmieniają wybór (roving tabindex), przyciski mają cel 44 px", async () => {
    render(
      <MCategorySheet usedColors={[]} onSaved={vi.fn()} onCancel={vi.fn()} />,
    );
    const kolory = screen.getAllByRole("radio");
    const wybrany = kolory.find(
      (k) => k.getAttribute("aria-checked") === "true",
    )!;
    expect(wybrany).toHaveAttribute("tabindex", "0");
    expect(wybrany).toHaveClass("after:-inset-y-1");
    wybrany.focus();
    await userEvent.keyboard("{ArrowRight}");
    const po = kolory.findIndex(
      (k) => k.getAttribute("aria-checked") === "true",
    );
    expect(po).toBe((kolory.indexOf(wybrany) + 1) % kolory.length);
    expect(kolory[po]).toHaveFocus();
  });

  it("podgląd pokazuje nazwę z paskiem koloru; „Dodaj” zapisuje i oddaje kategorię", async () => {
    createCategory.mockResolvedValue({ ok: true, id: "k9" });
    const onSaved = vi.fn();
    render(<MCategorySheet onSaved={onSaved} onCancel={vi.fn()} />);
    const arkusz = screen.getByRole("dialog", { name: "Nowa kategoria" });
    expect(arkusz).toHaveTextContent("Bez nazwy");
    await userEvent.type(
      screen.getByRole("textbox", { name: "Nazwa" }),
      "Języki",
    );
    expect(arkusz).toHaveTextContent("Języki");
    await userEvent.click(screen.getByRole("radio", { name: "Fioletowy" }));
    await userEvent.click(screen.getAllByRole("button", { name: "Dodaj" })[0]);
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

  it("błąd zapisu zostaje w arkuszu, „Anuluj” zamyka", async () => {
    createCategory.mockResolvedValue({ ok: false, message: "Nie udało się." });
    const onSaved = vi.fn();
    const onCancel = vi.fn();
    render(<MCategorySheet onSaved={onSaved} onCancel={onCancel} />);
    await userEvent.type(screen.getByRole("textbox", { name: "Nazwa" }), "X");
    await userEvent.click(screen.getAllByRole("button", { name: "Dodaj" })[0]);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się.",
    );
    expect(onSaved).not.toHaveBeenCalled();
    await userEvent.click(screen.getAllByRole("button", { name: "Anuluj" })[0]);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
