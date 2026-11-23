import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { IconPicker } from "./icon-picker";
import { ICON_KEYWORDS } from "./page-icons";

// Tymczasowy picker (pełny przepisuje Task 3)
describe("IconPicker", () => {
  it("pusty wybór pokazuje polecane ikony; kliknięcie → onPick('lucide:<nazwa>')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="" onPick={onPick} />);
    expect(screen.getAllByRole("button", { name: /^Ikona / })).toHaveLength(ICON_KEYWORDS.length);
    await user.click(screen.getByRole("button", { name: "Ikona rocket" }));
    expect(onPick).toHaveBeenCalledWith("lucide:rocket");
  });

  it("wyszukiwanie po polsku; brak trafień → „Brak wyników”", async () => {
    const user = userEvent.setup();
    render(<IconPicker value="" onPick={vi.fn()} />);
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "ksiazki");
    expect(screen.getByRole("button", { name: "Ikona book-open" })).toBeInTheDocument();
    await user.clear(screen.getByRole("textbox", { name: "Szukaj ikony" }));
    await user.type(screen.getByRole("textbox", { name: "Szukaj ikony" }), "xyzxyz");
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
  });

  it("obecna ikona jest zaznaczona; „Usuń” → onPick('')", async () => {
    const user = userEvent.setup();
    const onPick = vi.fn();
    render(<IconPicker value="lucide:rocket" onPick={onPick} />);
    expect(screen.getByRole("button", { name: "Ikona rocket" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onPick).toHaveBeenCalledWith("");
  });
});
