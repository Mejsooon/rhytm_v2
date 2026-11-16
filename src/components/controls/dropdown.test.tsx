import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dropdown, type DropdownOption } from "./dropdown";

const OPCJE: DropdownOption<"cet" | "utc" | "est">[] = [
  { value: "cet", label: "Europa/Warszawa", hint: "UTC+01:00" },
  { value: "utc", label: "UTC" },
  { value: "est", label: "Nowy Jork", badge: { label: "Nowe", tone: "blue" } },
];

function Wrapper({ onChange }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState<"cet" | "utc" | "est" | null>("cet");
  return (
    <Dropdown
      ariaLabel="Strefa czasowa"
      value={v}
      options={OPCJE}
      onChange={(n) => {
        setV(n);
        onChange?.(n);
      }}
    />
  );
}

describe("Dropdown", () => {
  it("klik otwiera listbox; wybrana opcja ma aria-selected i znak ✓", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    const wybrana = screen.getByRole("option", { name: /Europa\/Warszawa/ });
    expect(wybrana).toHaveAttribute("aria-selected", "true");
    expect(wybrana).toHaveTextContent("✓");
    expect(screen.getByRole("option", { name: "UTC" })).toHaveAttribute(
      "aria-selected",
      "false",
    );
  });

  it("klik opcji woła onChange i zamyka listę", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    await userEvent.click(screen.getByRole("option", { name: "UTC" }));
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowDown + Enter wybiera następną opcję", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape zamyka bez onChange", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("klik poza zamyka listę", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renderuje hint i plakietkę", async () => {
    render(<Wrapper />);
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    expect(screen.getByText("UTC+01:00")).toBeInTheDocument();
    expect(screen.getByText("Nowe")).toBeInTheDocument();
  });

  it("lista jest w portalu — nie ginie w rodzicu z overflow: hidden", async () => {
    render(
      <div data-testid="rodzic" style={{ overflow: "hidden", height: 20 }}>
        <Wrapper />
      </div>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Strefa czasowa" }));
    const lista = screen.getByRole("listbox");
    expect(screen.getByTestId("rodzic")).not.toContainElement(lista);
    expect(lista).toBeVisible();
  });
});
