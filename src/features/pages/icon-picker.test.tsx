import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconPicker } from "./icon-picker";
import { ICON_KEYWORDS } from "./page-icons";

// Pełna lista nazw: 200 sztucznych ikon „zz-0…zz-199” (więcej niż limit 120) plus rocket
vi.mock("lucide-react/dynamic", () => ({
  iconNames: ["rocket", ...Array.from({ length: 200 }, (_, i) => `zz-${i}`)],
  DynamicIcon: () => null,
}));

describe("IconPicker", () => {
  it("pusty wybór pokazuje polecane ikony (przyciski nazwane nazwą Lucide)", () => {
    render(<IconPicker value="" onPick={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /^[a-z0-9-]+$/ })).toHaveLength(ICON_KEYWORDS.length);
  });

  it("„rakieta” pokazuje przycisk rocket; kliknięcie → onPick('lucide:rocket')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="" onPick={onPick} />);
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "rakieta");
    await user.click(screen.getByRole("button", { name: "rocket" }));
    expect(onPick).toHaveBeenCalledWith("lucide:rocket");
  });

  it("brak trafień → „Brak wyników”", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onPick={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "xyzxyz");
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
  });

  it("obecna ikona ma aria-pressed; „Usuń” → onPick('')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="lucide:rocket" onPick={onPick} />);
    expect(screen.getByRole("button", { name: "rocket" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onPick).toHaveBeenCalledWith("");
  });

  it("nie ma zakładek Emoji/Ikony ani wyboru koloru", () => {
    render(<IconPicker value="" onPick={vi.fn()} />);
    expect(screen.queryByRole("tab")).not.toBeInTheDocument();
    expect(screen.queryByText("Emoji")).not.toBeInTheDocument();
    expect(screen.queryByText(/^kolor/i)).not.toBeInTheDocument();
  });

  it("siatka ma 8 kolumn", () => {
    render(<IconPicker value="" onPick={vi.fn()} />);
    const siatka = screen.getByRole("button", { name: "rocket" }).parentElement;
    expect(siatka?.className).toContain("grid-cols-8");
  });

  it("pełna lista nazw ładuje się po zamontowaniu; do tego czasu działają polecane", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onPick={vi.fn()} />);
    // zaraz po renderze (zanim zakończy się import w useEffect) „zz-” nie istnieje
    expect(screen.queryByRole("button", { name: "zz-1" })).not.toBeInTheDocument();
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "zz-1");
    // po załadowaniu trafia w całym zestawie
    expect(await screen.findByRole("button", { name: "zz-1" })).toBeInTheDocument();
  });

  it("więcej niż 120 trafień → 120 przycisków i podpis „Wpisz dokładniej, żeby zawęzić”", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onPick={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "zz-");
    expect(await screen.findByText("Wpisz dokładniej, żeby zawęzić")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^zz-/ })).toHaveLength(120);
  });
});
