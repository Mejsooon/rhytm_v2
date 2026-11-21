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
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
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
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    await userEvent.click(screen.getByRole("option", { name: "UTC" }));
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("ArrowDown + Enter wybiera następną opcję", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(onChange).toHaveBeenCalledWith("utc");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape zamyka bez onChange", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("klik poza zamyka listę", async () => {
    render(<Wrapper />);
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    await userEvent.click(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("renderuje hint i plakietkę", async () => {
    render(<Wrapper />);
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    expect(screen.getByText("UTC+01:00")).toBeInTheDocument();
    expect(screen.getByText("Nowe")).toBeInTheDocument();
  });

  it("lista jest w portalu — nie ginie w rodzicu z overflow: hidden", async () => {
    render(
      <div data-testid="rodzic" style={{ overflow: "hidden", height: 20 }}>
        <Wrapper />
      </div>,
    );
    await userEvent.click(
      screen.getByRole("button", { name: "Strefa czasowa" }),
    );
    const lista = screen.getByRole("listbox");
    expect(screen.getByTestId("rodzic")).not.toContainElement(lista);
    expect(lista).toBeVisible();
  });

  it("variant select: ikona góra-dół i podpowiedź wybranej opcji w wyzwalaczu", () => {
    render(
      <Dropdown
        variant="select"
        value="PLN"
        onChange={() => {}}
        ariaLabel="Waluta"
        options={[{ value: "PLN", label: "PLN", hint: "zł" }]}
      />,
    );
    const wyzwalacz = screen.getByRole("button", { name: "Waluta" });
    expect(wyzwalacz).toHaveTextContent("zł");
    const hint = screen.getByText("zł");
    expect(hint).toHaveClass("text-xs", "text-muted-foreground");
    expect(hint).not.toHaveClass("font-mono");
    const ikona = wyzwalacz.querySelector("svg")!;
    expect(ikona).toHaveClass("lucide-chevrons-up-down", "size-4", "text-muted-foreground");
    expect(wyzwalacz).toHaveClass("h-8");
  });

  it("domyślny wariant bez zmian", () => {
    render(
      <Dropdown
        value="PLN"
        onChange={() => {}}
        ariaLabel="Waluta"
        options={[{ value: "PLN", label: "PLN", hint: "zł" }]}
      />,
    );
    const wyzwalacz = screen.getByRole("button", { name: "Waluta" });
    expect(wyzwalacz).not.toHaveTextContent("zł");
    expect(wyzwalacz.className).toBe(
      "h-8 w-full min-w-0 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-sm font-normal text-foreground shadow-xs outline-none transition-[box-shadow,border-color] duration-150 placeholder:text-faint-foreground focus:border-ring focus:shadow-halo aria-[invalid=true]:border-destructive/[.36] aria-[invalid=true]:focus:shadow-[0_0_0_3px_rgba(239,68,68,.16)] disabled:cursor-not-allowed disabled:opacity-[.64] max-[799px]:h-11 max-[799px]:text-[15px] flex cursor-pointer items-center justify-between gap-2 text-left aria-expanded:border-ring aria-expanded:shadow-halo",
    );
    expect(wyzwalacz.querySelector("svg")).toHaveClass("lucide-chevron-down", "size-3");
  });

  it("hint na liście: select bez font-mono (tabular-nums), menu z font-mono", async () => {
    const opcje = [{ value: "PLN", label: "PLN", hint: "zł" }];
    const { unmount } = render(
      <Dropdown variant="select" value="PLN" onChange={() => {}} ariaLabel="Waluta" options={opcje} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Waluta" }));
    let hint = screen.getByRole("option").querySelector("span > span")!;
    expect(hint).toHaveClass("tabular-nums", "text-xs", "font-normal", "text-muted-foreground");
    expect(hint).not.toHaveClass("font-mono");
    unmount();
    render(<Dropdown value="PLN" onChange={() => {}} ariaLabel="Waluta" options={opcje} />);
    await userEvent.click(screen.getByRole("button", { name: "Waluta" }));
    hint = screen.getByRole("option").querySelector("span > span")!;
    expect(hint).toHaveClass("font-mono");
  });
});
