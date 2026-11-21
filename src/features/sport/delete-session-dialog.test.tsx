import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { deleteSession, skipTemplateOccurrence } = vi.hoisted(() => ({
  deleteSession: vi.fn(),
  skipTemplateOccurrence: vi.fn(),
}));
vi.mock("./actions", () => ({ deleteSession, skipTemplateOccurrence }));

import { DeleteSessionDialog } from "./delete-session-dialog";
import type { SportItem } from "./model";
import { daneSportu, SZABLON_PUSH } from "./sport-test-data";

const element = (klucz: string) =>
  daneSportu().items.find((i) => i.key === klucz) as SportItem;

beforeEach(() => vi.clearAllMocks());

describe("DeleteSessionDialog", () => {
  it("„Usunąć trening?” z opisem; Usuń usuwa sesję", async () => {
    deleteSession.mockResolvedValue({ ok: true });
    const onDeleted = vi.fn();
    render(
      <DeleteSessionDialog
        item={element("s:a1000000-0000-4000-8000-000000000015")}
        clock="24"
        onDeleted={onDeleted}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.getByText("Usunąć trening?")).toBeInTheDocument();
    expect(
      screen.getByText("„Długi bieg” · nd 15.11 · 09:00–10:10"),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(deleteSession).toHaveBeenCalledWith(
      "a1000000-0000-4000-8000-000000000015",
    );
    expect(onDeleted).toHaveBeenCalled();
  });

  it("wystąpienie szablonu zapisuje pominięcie", async () => {
    skipTemplateOccurrence.mockResolvedValue({ ok: true });
    render(
      <DeleteSessionDialog
        item={element(`t:${SZABLON_PUSH}:2026-11-19`)}
        clock="24"
        onDeleted={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(skipTemplateOccurrence).toHaveBeenCalledWith(
      SZABLON_PUSH,
      "2026-11-19",
    );
    expect(deleteSession).not.toHaveBeenCalled();
  });

  it("błąd zostaje w oknie; Anuluj zamyka", async () => {
    deleteSession.mockResolvedValue({
      ok: false,
      message: "Nie znaleziono treningu.",
    });
    const onDeleted = vi.fn();
    const onCancel = vi.fn();
    render(
      <DeleteSessionDialog
        item={element("s:a1000000-0000-4000-8000-000000000015")}
        clock="24"
        onDeleted={onDeleted}
        onCancel={onCancel}
      />,
    );
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass(
      "border-transparent",
      "bg-transparent",
      "hover:bg-accent",
    );
    expect(
      screen.getByRole("button", { name: "Anuluj" }).className,
    ).not.toContain("border-input");
    // Rozmiar md: 32 px na webie i 44 px na telefonie (cel dotykowy)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass(
      "h-8",
      "max-[799px]:h-11",
    );
    // Okno w stylu .dlg: promień 16 px, ramka border, cień pop, szara stopka
    expect(screen.getByRole("alertdialog")).toHaveClass(
      "min-[800px]:rounded-xl",
      "min-[800px]:border-border",
      "min-[800px]:shadow-pop",
    );
    // Telefon: promień 16 px bez zmian
    expect(screen.getByRole("alertdialog")).toHaveClass(
      "max-[799px]:rounded-xl",
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Nie znaleziono treningu.",
    );
    expect(onDeleted).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
  });
});
