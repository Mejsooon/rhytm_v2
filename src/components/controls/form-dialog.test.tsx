import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FormDialog } from "./form-dialog";

describe("FormDialog", () => {
  it("tytuł jest nazwą dostępną okna; Escape woła onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialog open onOpenChange={onOpenChange} title="Nowy blok" footer={<button>Zapisz</button>}>
        <p>Treść</p>
      </FormDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Nowy blok" })).toBeInTheDocument();
    expect(screen.getByText("Treść")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("zamknięte nie renderuje okna", () => {
    render(
      <FormDialog open={false} onOpenChange={() => {}} title="X">
        <p>Treść</p>
      </FormDialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
