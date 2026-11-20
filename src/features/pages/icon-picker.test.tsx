import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconPicker } from "./icon-picker";

describe("IconPicker", () => {
  it("domyślnie zakładka Emoji z 56 emoji; „ksiazki” zostawia 📚", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="" onPick={onPick} />);
    expect(screen.getByRole("button", { name: "Emoji" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getAllByRole("button", { name: /^Emoji / })).toHaveLength(56);

    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "ksiazki");
    const wyniki = screen.getAllByRole("button", { name: /^Emoji / });
    expect(wyniki).toHaveLength(1);
    expect(wyniki[0]).toHaveTextContent("📚");
    await user.click(wyniki[0]);
    expect(onPick).toHaveBeenCalledWith("📚");
  });

  it("zakładka Ikony: kolor + ikona → onPick('lucide:book-open:blue')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Ikony" }));
    expect(screen.getAllByRole("button", { name: /^Ikona / })).toHaveLength(37);
    const kolory = screen.getByRole("group", { name: "Kolor ikony" });
    expect(within(kolory).getAllByRole("button")).toHaveLength(8);
    expect(within(kolory).getByRole("button", { name: "Szary" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(kolory).getByRole("button", { name: "Niebieski" }));
    expect(within(kolory).getByRole("button", { name: "Niebieski" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Ikona książka czytanie" }));
    expect(onPick).toHaveBeenCalledWith("lucide:book-open:blue");
  });

  it("etykiety przycisków emoji i ikon są unikalne", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onPick={vi.fn()} />);
    const emoji = screen.getAllByRole("button", { name: /^Emoji / }).map((b) => b.getAttribute("aria-label"));
    expect(new Set(emoji).size).toBe(56);
    await user.click(screen.getByRole("button", { name: "Ikony" }));
    const ikony = screen.getAllByRole("button", { name: /^Ikona / }).map((b) => b.getAttribute("aria-label"));
    expect(new Set(ikony).size).toBe(37);
  });

  it("„Usuń” → onPick('')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="📚" onPick={onPick} />);
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onPick).toHaveBeenCalledWith("");
  });

  it("obecna ikona otwiera jej zakładkę i kolor, jest zaznaczona; brak trafień → „Brak wyników”", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="lucide:rocket:teal" onPick={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Ikony" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Morski" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Ikona start projekt" })).toHaveAttribute("aria-pressed", "true");
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "xyzxyz");
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
    expect(screen.getByText("Spróbuj innego słowa.")).toHaveClass("text-xs", "text-muted-foreground");
  });
});
