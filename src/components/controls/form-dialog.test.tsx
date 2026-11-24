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

  it("✕ jak .btng.ic.sm z makiet: 28 px bez ramki, ikona X, na telefonie cel 44 px", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X">
        <p>Treść</p>
      </FormDialog>,
    );
    const zamknij = screen.getByRole("button", { name: "Zamknij" });
    // ghost: przezroczyste tło i ramka, hover accent; sm + icon: 28 × 28 px
    expect(zamknij).toHaveClass(
      "h-7",
      "w-7",
      "border-transparent",
      "bg-transparent",
      "hover:bg-accent",
      "max-[799px]:size-11",
    );
    expect(zamknij.className).not.toContain("border-input");
    expect(zamknij.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(zamknij).not.toHaveTextContent("✕");
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

describe("FormDialog — arkusz telefonu (CM)", () => {
  it("tło bez rozmycia na telefonie, arkusz rounded-t-2xl i max-h 88%, uchwyt m-grab", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X">
        <p>Treść</p>
      </FormDialog>,
    );
    const okno = screen.getByRole("dialog", { name: "X" });
    expect(okno).toHaveClass("max-[799px]:rounded-t-2xl", "max-[799px]:max-h-[88%]");
    const tlo = document.querySelector("div.fixed.inset-0") as HTMLElement;
    expect(tlo.className).toContain("bg-black/[.32]");
    expect(tlo.className).toContain("max-[799px]:backdrop-blur-none");
    expect(okno.querySelector(".m-grab")).not.toBeNull();
  });

  it("stopka ma na telefonie dolny odstęp 28 px", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X" footer={<button>Dodaj</button>}>
        <p>Treść</p>
      </FormDialog>,
    );
    const stopka = screen.getByRole("button", { name: "Dodaj" }).parentElement as HTMLElement;
    expect(stopka).toHaveClass("max-[799px]:pb-7");
    expect(stopka).not.toHaveClass("max-[799px]:hidden");
  });

  it("domyślnie phoneHeader=close: ✕ 44 px widoczny na telefonie, bez „Anuluj”", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X">
        <p>Treść</p>
      </FormDialog>,
    );
    const zamknij = screen.getByRole("button", { name: "Zamknij" });
    expect(zamknij).toHaveClass("max-[799px]:size-11");
    expect(zamknij).not.toHaveClass("max-[799px]:hidden");
    expect(screen.queryByRole("button", { name: "Anuluj" })).not.toBeInTheDocument();
  });

  it("phoneHeader=actions: „Anuluj” woła onClick, przycisk główny w nagłówku, ✕ i stopka ukryte na telefonie", async () => {
    const onCancel = vi.fn();
    render(
      <FormDialog
        open
        onOpenChange={() => {}}
        title="Nowy blok"
        phoneHeader="actions"
        phoneCancel={{ label: "Anuluj", onClick: onCancel }}
        phoneSubmit={<button>Zapisz</button>}
        footer={<button>Utwórz</button>}
      >
        <p>Treść</p>
      </FormDialog>,
    );
    const anuluj = screen.getByRole("button", { name: "Anuluj" });
    expect(anuluj).toHaveClass("min-[800px]:hidden", "text-muted-foreground");
    await userEvent.click(anuluj);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Zapisz" }).parentElement).toHaveClass("min-[800px]:hidden");
    expect(screen.getByRole("button", { name: "Zamknij" })).toHaveClass("max-[799px]:hidden");
    expect(screen.getByRole("button", { name: "Utwórz" }).parentElement).toHaveClass("max-[799px]:hidden");
    const naglowek = screen.getByRole("heading", { name: "Nowy blok" }).parentElement?.parentElement as HTMLElement;
    expect(naglowek).toHaveClass("max-[799px]:border-b");
  });

  it("web (≥ 800 px): klasy min-[800px]: okna, nagłówka i stopki bez zmian", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="X" footer={<button>Zapisz</button>}>
        <p>Treść</p>
      </FormDialog>,
    );
    const web = (el: Element) =>
      el.className.split(/\s+/).filter((k) => k.startsWith("min-[800px]:"));
    expect(web(screen.getByRole("dialog", { name: "X" }))).toEqual([
      "min-[800px]:top-1/2",
      "min-[800px]:left-1/2",
      "min-[800px]:max-h-[calc(100%-64px)]",
      "min-[800px]:w-[min(460px,calc(100%-32px))]",
      "min-[800px]:-translate-x-1/2",
      "min-[800px]:-translate-y-1/2",
      "min-[800px]:border",
      "min-[800px]:border-border",
      "min-[800px]:shadow-pop",
    ]);
    expect(web(screen.getByRole("button", { name: "Zapisz" }).parentElement as Element)).toEqual([
      "min-[800px]:rounded-b-[15px]",
    ]);
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

  it("opis jest powiązany z oknem przez aria-describedby", () => {
    render(
      <FormDialog open onOpenChange={() => {}} title="Nowy blok" description="Podpowiedź do okna">
        <p>Treść</p>
      </FormDialog>,
    );
    const okno = screen.getByRole("dialog", { name: "Nowy blok" });
    const opis = screen.getByText("Podpowiedź do okna");
    expect(okno).toHaveAttribute("aria-describedby", opis.id);
    expect(opis.id).not.toBe("");
  });

  it("bez opisu nie ma aria-describedby ani ostrzeżenia Radix", () => {
    const blad = vi.spyOn(console, "error").mockImplementation(() => {});
    const ostrzezenie = vi.spyOn(console, "warn").mockImplementation(() => {});
    render(
      <FormDialog open onOpenChange={() => {}} title="Nowy blok">
        <p>Treść</p>
      </FormDialog>,
    );
    expect(screen.getByRole("dialog", { name: "Nowy blok" })).not.toHaveAttribute("aria-describedby");
    expect(blad).not.toHaveBeenCalled();
    expect(ostrzezenie).not.toHaveBeenCalled();
    blad.mockRestore();
    ostrzezenie.mockRestore();
  });
});
