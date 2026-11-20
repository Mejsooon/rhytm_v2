import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Dropdown } from "./dropdown";
import { FormDialog } from "./form-dialog";

describe("FormDialog", () => {
  it("tytuł jest nazwą dostępną okna; Escape woła onOpenChange(false)", async () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialog
        open
        onOpenChange={onOpenChange}
        title="Nowy blok"
        footer={<button>Zapisz</button>}
      >
        <p>Treść</p>
      </FormDialog>,
    );
    expect(
      screen.getByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Treść")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Zapisz" })).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("stopka ma tło i ramkę COSS", () => {
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        title="X"
        footer={<button>Zapisz</button>}
      >
        <p>Treść</p>
      </FormDialog>,
    );
    const stopka = screen.getByRole("button", { name: "Zapisz" })
      .parentElement as HTMLElement;
    expect(stopka).toHaveClass("border-t", "bg-black/[.025]");
  });

  it("okno ma promień 16 px", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X">
        <p>Treść</p>
      </FormDialog>,
    );
    expect(screen.getByRole("dialog", { name: "X" })).toHaveClass("rounded-xl");
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

describe("FormDialog z Dropdown w środku", () => {
  function Okno({
    onChange,
    onOpenChange,
  }: {
    onChange: (v: string) => void;
    onOpenChange: (o: boolean) => void;
  }) {
    return (
      <FormDialog open onOpenChange={onOpenChange} title="Nowy blok">
        <Dropdown
          ariaLabel="Strefa"
          value="cet"
          onChange={onChange}
          options={[
            { value: "cet", label: "Europa/Warszawa" },
            { value: "utc", label: "UTC" },
            { value: "est", label: "Nowy Jork" },
          ]}
        />
      </FormDialog>
    );
  }

  it("klik opcji woła onChange i nie zamyka okna", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Okno onChange={onChange} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa" }));
    await userEvent.click(screen.getByRole("option", { name: "UTC" }));
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(
      screen.getByRole("dialog", { name: "Nowy blok" }),
    ).toBeInTheDocument();
  });

  it("ArrowDown + Enter działa w oknie, okno zostaje otwarte", async () => {
    const onChange = vi.fn();
    const onOpenChange = vi.fn();
    render(<Okno onChange={onChange} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa" }));
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });

  it("Escape zamyka tylko listę, nie okno", async () => {
    const onOpenChange = vi.fn();
    render(<Okno onChange={() => {}} onOpenChange={onOpenChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});
