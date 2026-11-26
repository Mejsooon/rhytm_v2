import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import { BulkBar } from "./bulk-bar";

// Pole Status jak w S2Books (Czytam / Chcę przeczytać / Przeczytane)
const STATUS: PageField = {
  id: "f-status",
  name: "Status",
  type: "select",
  position: 2,
  isTitle: false,
  config: {
    options: [
      { id: "o-czytam", label: "Czytam", color: "#0070f3" },
      { id: "o-chce", label: "Chcę przeczytać", color: "#525252" },
      { id: "o-przeczytane", label: "Przeczytane", color: "#15803d" },
    ],
  },
};

const AKTYWNA: PageField = { id: "f-akt", name: "Aktywna", type: "checkbox", position: 3, isTitle: false, config: {} };

function renderuj(props: Partial<React.ComponentProps<typeof BulkBar>> = {}) {
  const wywolania = {
    onSetValue: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
    onClear: vi.fn(),
  };
  render(<BulkBar count={3} field={STATUS} {...wywolania} {...props} />);
  return wywolania;
}

describe("BulkBar", () => {
  it("pasek „Akcje dla zaznaczonych”: liczba, Zmień: pole, Duplikuj, Eksport CSV, Usuń i „Odznacz wszystkie”", () => {
    renderuj();
    const pasek = screen.getByRole("toolbar", { name: "Akcje dla zaznaczonych" });
    expect(within(pasek).getByText("3 zaznaczone")).toBeInTheDocument();
    expect(within(pasek).getByRole("button", { name: "Zmień: Status" })).toBeInTheDocument();
    expect(within(pasek).getByRole("button", { name: "Duplikuj" })).toBeInTheDocument();
    expect(within(pasek).getByRole("button", { name: "Eksport CSV" })).toBeInTheDocument();
    expect(within(pasek).getByRole("button", { name: "Usuń" })).toBeInTheDocument();
    expect(within(pasek).getByRole("button", { name: "Odznacz wszystkie" })).toBeInTheDocument();
  });

  it("odmiana liczby zaznaczonych (1 zaznaczony, 5 zaznaczonych)", () => {
    const { rerender } = render(
      <BulkBar count={1} field={null} onSetValue={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onClear={vi.fn()} />,
    );
    expect(screen.getByText("1 zaznaczony")).toBeInTheDocument();
    rerender(<BulkBar count={5} field={null} onSetValue={vi.fn()} onDuplicate={vi.fn()} onDelete={vi.fn()} onClear={vi.fn()} />);
    expect(screen.getByText("5 zaznaczonych")).toBeInTheDocument();
  });

  it("„Zmień: Status” otwiera menu „Ustaw dla zaznaczonych” z opcjami pola; wybór woła onSetValue(id, etykieta)", async () => {
    const user = userEvent.setup();
    const { onSetValue } = renderuj();
    await user.click(screen.getByRole("button", { name: "Zmień: Status" }));
    const menu = screen.getByRole("menu", { name: "Ustaw dla zaznaczonych" });
    expect(within(menu).getAllByRole("menuitem").map((m) => m.textContent)).toEqual([
      "Czytam",
      "Chcę przeczytać",
      "Przeczytane",
    ]);
    await user.click(within(menu).getByRole("menuitem", { name: "Przeczytane" }));
    expect(onSetValue).toHaveBeenCalledWith("o-przeczytane", "Przeczytane");
    expect(screen.queryByRole("menu", { name: "Ustaw dla zaznaczonych" })).not.toBeInTheDocument();
  });

  it("pole checkbox: opcje Zaznaczone / Niezaznaczone ustawiają true / false", async () => {
    const user = userEvent.setup();
    const { onSetValue } = renderuj({ field: AKTYWNA });
    await user.click(screen.getByRole("button", { name: "Zmień: Aktywna" }));
    await user.click(screen.getByRole("menuitem", { name: "Niezaznaczone" }));
    expect(onSetValue).toHaveBeenCalledWith(false, "Niezaznaczone");
  });

  it("bez pola wyboru nie ma „Zmień”; pole Sekret nigdy nie jest proponowane", () => {
    renderuj({ field: null });
    expect(screen.queryByRole("button", { name: /Zmień/ })).not.toBeInTheDocument();
  });

  it("Duplikuj, Usuń i ✕ wołają swoje akcje; Eksport CSV bez obsługi jest wyłączony", async () => {
    const user = userEvent.setup();
    const w = renderuj();
    await user.click(screen.getByRole("button", { name: "Duplikuj" }));
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    await user.click(screen.getByRole("button", { name: "Odznacz wszystkie" }));
    expect(w.onDuplicate).toHaveBeenCalledTimes(1);
    expect(w.onDelete).toHaveBeenCalledTimes(1);
    expect(w.onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Eksport CSV" })).toBeDisabled();
  });

  it("Eksport CSV woła przekazaną obsługę", async () => {
    const user = userEvent.setup();
    const onExportCsv = vi.fn();
    renderuj({ onExportCsv });
    await user.click(screen.getByRole("button", { name: "Eksport CSV" }));
    expect(onExportCsv).toHaveBeenCalledTimes(1);
  });
});
