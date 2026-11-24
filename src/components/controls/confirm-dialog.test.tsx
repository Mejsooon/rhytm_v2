import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog", () => {
  it("ma rolę alertdialog z nazwą z tytułu i opisem", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Usunąć blok?"
        description="Opis"
        confirmLabel="Usuń"
        onConfirm={() => {}}
      />,
    );
    expect(
      screen.getByRole("alertdialog", { name: "Usunąć blok?" }),
    ).toHaveAccessibleDescription("Opis");
  });

  it("potwierdzenie woła onConfirm, „Anuluj” zamyka okno", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Usunąć?"
        confirmLabel="Usuń"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Usuń" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("pending blokuje oba przyciski i Esc", async () => {
    const onOpenChange = vi.fn();
    render(
      <ConfirmDialog
        open
        onOpenChange={onOpenChange}
        title="Usunąć?"
        confirmLabel="Usuń"
        onConfirm={() => {}}
        pending
      />,
    );
    expect(screen.getByRole("button", { name: "Usuń" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("na telefonie to arkusz od dołu z uchwytem, na webie karta", () => {
    render(
      <ConfirmDialog
        open
        onOpenChange={() => {}}
        title="Usunąć?"
        confirmLabel="Usuń"
        onConfirm={() => {}}
      />,
    );
    const okno = screen.getByRole("alertdialog");
    expect(okno).toHaveClass(
      "max-[799px]:bottom-0",
      "max-[799px]:rounded-t-2xl",
      "min-[800px]:rounded-xl",
    );
    expect(okno.querySelector(".m-grab")).not.toBeNull();
    // Telefon: siatka 2 kolumn, „Anuluj” z ramką (.btn) po lewej, potwierdzenie po prawej, oba 44 px
    const potwierdz = screen.getByRole("button", { name: "Usuń" });
    const anuluj = screen.getByRole("button", { name: "Anuluj" });
    expect(potwierdz.parentElement).toHaveClass("max-[799px]:grid", "max-[799px]:grid-cols-2", "max-[799px]:gap-2.5");
    expect(potwierdz.parentElement).not.toHaveClass("max-[799px]:flex-col-reverse");
    expect(anuluj).toHaveClass("max-[799px]:h-11", "max-[799px]:border-input", "max-[799px]:bg-white");
    expect(potwierdz).toHaveClass("max-[799px]:h-11");
    expect(okno).toHaveClass("max-[799px]:border", "max-[799px]:border-b-0", "max-[799px]:pb-[max(20px,env(safe-area-inset-bottom))]");
  });
});
