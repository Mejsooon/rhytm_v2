import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { changeOccurrence } = vi.hoisted(() => ({ changeOccurrence: vi.fn() }));
vi.mock("./actions", () => ({ changeOccurrence }));

import { DeleteBlockDialog } from "./delete-block-dialog";
import type { Occurrence } from "./occurrences";

function wystapienie(extra: Partial<Occurrence> = {}): Occurrence {
  return {
    key: "b1:2026-11-17",
    blockId: "b1",
    date: "2026-11-17",
    startMin: 600,
    durationMin: 150,
    title: "rhytm — kod",
    categoryId: null,
    note: null,
    remind: true,
    recurring: false,
    recurrence: null,
    modified: false,
    ...extra,
  };
}

function wyrenderuj(o: Occurrence) {
  const onDeleted = vi.fn();
  const onCancel = vi.fn();
  render(
    <DeleteBlockDialog
      occurrence={o}
      clock="24"
      onDeleted={onDeleted}
      onCancel={onCancel}
    />,
  );
  return { onDeleted, onCancel };
}

beforeEach(() => vi.clearAllMocks());

describe("DeleteBlockDialog", () => {
  it("blok jednorazowy: „Usunąć blok?” i usunięcie po „Usuń”", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    const { onDeleted } = wyrenderuj(wystapienie());
    expect(
      screen.getByRole("alertdialog", { name: "Usunąć blok?" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-17",
      scope: "all",
      delete: true,
    });
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("opis z nazwą, dniem i godzinami jak w makiecie, bez przycisku ✕", () => {
    wyrenderuj(
      wystapienie({ title: "Bieg 10 km", startMin: 960, durationMin: 60 }),
    );
    const okno = screen.getByRole("alertdialog", { name: "Usunąć blok?" });
    expect(okno).toHaveAccessibleDescription(
      "„Bieg 10 km” · wt 17.11 · 16:00–17:00",
    );
    expect(
      screen.queryByRole("button", { name: "Zamknij" }),
    ).not.toBeInTheDocument();
  });

  it("na webie wygląda jak .dlg z coss.css: promień 16 px, cień pop, szara stopka", () => {
    wyrenderuj(wystapienie());
    const okno = screen.getByRole("alertdialog", { name: "Usunąć blok?" });
    expect(okno).toHaveClass("min-[800px]:rounded-xl", "min-[800px]:border-border", "min-[800px]:shadow-pop");
    expect(screen.getByRole("button", { name: "Usuń" }).parentElement).toHaveClass("min-[800px]:bg-black/[.025]", "min-[800px]:border-t");
    expect(screen.getByRole("button", { name: "Usuń" })).toHaveClass("h-8", "bg-destructive");
    // CDeleteBlockDialog: nagłówek z dolnym odstępem 20 px, kosz przy „Usuń” (tylko web)
    expect(screen.getByRole("heading", { name: "Usunąć blok?" }).parentElement).toHaveClass("min-[800px]:pb-5");
    expect(screen.getByRole("button", { name: "Usuń" }).querySelector("svg")).toHaveClass("size-4", "max-[799px]:hidden");
  });

  it("w trakcie usuwania przyciski są zablokowane, a Esc nie zamyka", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    changeOccurrence.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const { onCancel, onDeleted } = wyrenderuj(wystapienie());
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(screen.getByRole("button", { name: "Usuń" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onCancel).not.toHaveBeenCalled();
    zakoncz({ ok: true });
    await waitFor(() => expect(onDeleted).toHaveBeenCalled());
  });

  it("błąd usuwania zostaje w oknie", async () => {
    changeOccurrence.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    const { onDeleted } = wyrenderuj(wystapienie());
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
    expect(onDeleted).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Usuń" })).toBeEnabled();
  });

  it("Anuluj nic nie usuwa", async () => {
    const { onCancel } = wyrenderuj(wystapienie());
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
    expect(changeOccurrence).not.toHaveBeenCalled();
  });

  it("blok cykliczny: pyta o zakres i usuwa z oryginalną datą wystąpienia", async () => {
    changeOccurrence.mockResolvedValue({ ok: true });
    wyrenderuj(
      wystapienie({
        key: "b1:2026-11-10",
        date: "2026-11-12",
        recurring: true,
        recurrence: { freq: "weekly" },
      }),
    );
    expect(
      screen.getByRole("dialog", { name: "Usuwasz blok, który się powtarza" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText(/To i następne/));
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(changeOccurrence).toHaveBeenCalledWith({
      blockId: "b1",
      date: "2026-11-10",
      scope: "following",
      delete: true,
    });
  });

  it("błąd akcji zostaje w oknie", async () => {
    changeOccurrence.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    const { onDeleted } = wyrenderuj(wystapienie());
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(
      await screen.findByText("Nie udało się zapisać. Spróbuj ponownie."),
    ).toBeInTheDocument();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});
