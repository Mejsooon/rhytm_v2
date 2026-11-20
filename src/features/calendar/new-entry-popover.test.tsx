import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { NewEntryPopover } from "./new-entry-popover";

function wyrenderuj(startMin = 600, clock: "24" | "12" = "24") {
  const anchor = document.createElement("div");
  document.body.appendChild(anchor);
  const onBlock = vi.fn();
  const onClose = vi.fn();
  render(
    <NewEntryPopover
      anchor={anchor}
      date="2026-11-17"
      startMin={startMin}
      clock={clock}
      onBlock={onBlock}
      onClose={onClose}
    />,
  );
  return { onBlock, onClose };
}

describe("NewEntryPopover", () => {
  it("wygląd z CToday: .pop z paddingiem 4 px, pozycje 44 px z kafelkiem ikony 28 px", () => {
    wyrenderuj();
    expect(screen.getByRole("dialog", { name: "Nowy wpis" })).toHaveClass("w-[270px]", "p-1", "rounded-lg", "shadow-lg");
    const blok = screen.getByRole("button", { name: /Blok/ });
    expect(blok).toHaveClass("min-h-11", "rounded-sm");
    expect(blok.firstElementChild).toHaveClass("size-7", "rounded-[8px]", "bg-success-soft", "text-success");
    expect(screen.getByRole("link", { name: /Bieg/ }).firstElementChild).toHaveClass("bg-warning/10", "text-warning-foreground");
  });

  it("pokazuje dzień i godzinę slotu", () => {
    wyrenderuj();
    expect(
      screen.getByRole("dialog", { name: "Nowy wpis" }),
    ).toBeInTheDocument();
    expect(screen.getByText("wt 17.11 · 10:00")).toBeInTheDocument();
  });

  it("w trybie 12 h pokazuje godzinę z AM/PM", () => {
    wyrenderuj(14 * 60 + 30, "12");
    expect(screen.getByText("wt 17.11 · 2:30 PM")).toBeInTheDocument();
  });

  it("„Blok” woła onBlock", async () => {
    const { onBlock } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: /Blok/ }));
    expect(onBlock).toHaveBeenCalled();
  });

  it("Bieg i Siłownia to linki do Sportu z datą i godziną", () => {
    wyrenderuj(14 * 60 + 30, "12");
    expect(screen.getByRole("link", { name: /Bieg/ })).toHaveAttribute(
      "href",
      "/sport?nowy=bieg&data=2026-11-17&godzina=14:30",
    );
    expect(screen.getByRole("link", { name: /Siłownia/ })).toHaveAttribute(
      "href",
      "/sport?nowy=silownia&data=2026-11-17&godzina=14:30",
    );
  });

  it("✕ i Esc wołają onClose", async () => {
    const { onClose } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalled();
  });
});
