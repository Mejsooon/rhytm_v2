import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { TypeChangeDialog } from "./type-change-dialog";

describe("TypeChangeDialog", () => {
  it.each([
    [1, "1 wartość nie da się przenieść i zostaną wyczyszczone."],
    [3, "3 wartości nie da się przenieść i zostaną wyczyszczone."],
    [7, "7 wartości nie da się przenieść i zostaną wyczyszczone."],
  ])("pokazuje liczbę wartości: %i", (lost, tekst) => {
    render(<TypeChangeDialog lost={lost} onConfirm={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.getByText("Zmienić typ pola?")).toBeTruthy();
    expect(screen.getByText(tekst)).toBeTruthy();
    // .dlg: tekst 14 px, okno z promieniem 12 px i cieniem pop, szara stopka
    expect(screen.getByText(tekst)).toHaveClass("text-sm");
    expect(screen.getByRole("dialog")).toHaveClass("rounded-xl", "min-[800px]:shadow-pop", "min-[800px]:border-border");
  });

  it("Anuluj i Zmień typ wołają odpowiednie wywołania", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<TypeChangeDialog lost={2} onConfirm={onConfirm} onCancel={onCancel} />);
    // „Anuluj” bez ramki (ghost, .btng z makiet)
    expect(screen.getByRole("button", { name: "Anuluj" })).toHaveClass("border-transparent", "bg-transparent", "hover:bg-accent");
    expect(screen.getByRole("button", { name: "Anuluj" }).className).not.toContain("border-input");
    await user.click(screen.getByRole("button", { name: "Zmień typ" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
