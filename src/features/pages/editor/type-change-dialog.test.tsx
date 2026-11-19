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
  });

  it("Anuluj i Zmień typ wołają odpowiednie wywołania", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<TypeChangeDialog lost={2} onConfirm={onConfirm} onCancel={onCancel} />);
    await user.click(screen.getByRole("button", { name: "Zmień typ" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
