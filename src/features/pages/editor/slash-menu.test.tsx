import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { SlashMenu } from "./slash-menu";

describe("SlashMenu", () => {
  it("pokazuje 5 pozycji, nagłówek i stopkę", () => {
    render(<SlashMenu query="" active={0} onActive={vi.fn()} onPick={vi.fn()} />);
    expect(screen.getByRole("listbox", { name: "Bloki" })).toBeInTheDocument();
    expect(screen.getAllByRole("option")).toHaveLength(5);
    // Stopka: skróty jako .kbd (↑ ↓ wybór, Enter wstaw, Esc zamknij)
    const stopka = screen.getByText("zamknij").parentElement;
    expect(stopka).toHaveTextContent("↑↓ wybórEnter wstawEsc zamknij");
    expect(stopka?.querySelectorAll("kbd")).toHaveLength(4);
    expect(screen.getByText("Bloki")).toHaveClass("text-xs", "font-medium");
    // Ikona pozycji: .ico 32 px, promień 8, cień xs
    expect(screen.getAllByRole("option")[0].querySelector("span[aria-hidden]")).toHaveClass("size-8", "rounded-lg", "shadow-xs");
  });

  it("„tab” zostawia Tabelę", () => {
    render(<SlashMenu query="tab" active={0} onActive={vi.fn()} onPick={vi.fn()} />);
    const pozycje = screen.getAllByRole("option");
    expect(pozycje).toHaveLength(1);
    expect(pozycje[0]).toHaveTextContent("Tabela");
  });

  it("„xyz” pokazuje brak bloku", () => {
    render(<SlashMenu query="xyz" active={0} onActive={vi.fn()} onPick={vi.fn()} />);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("Brak bloku „xyz”")).toBeInTheDocument();
  });

  it("najechanie podświetla, klik wstawia pozycję", async () => {
    const user = userEvent.setup();
    const onActive = vi.fn();
    const onPick = vi.fn();
    render(<SlashMenu query="" active={0} onActive={onActive} onPick={onPick} />);
    const pozycje = screen.getAllByRole("option");
    expect(pozycje[0]).toHaveAttribute("aria-selected", "true");
    await user.hover(pozycje[2]);
    expect(onActive).toHaveBeenCalledWith(2);
    await user.click(pozycje[2]);
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ type: "heading" }));
  });
});
