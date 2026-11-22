import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Stepper } from "./stepper";

function ustaw(over: Partial<Parameters<typeof Stepper>[0]> = {}) {
  const onDec = vi.fn();
  const onInc = vi.fn();
  render(
    <Stepper
      value="25 km"
      onDec={onDec}
      onInc={onInc}
      ariaLabel="Cel tygodniowy"
      {...over}
    />,
  );
  return { onDec, onInc };
}

describe("Stepper", () => {
  it("pokazuje wartość", () => {
    ustaw();
    expect(screen.getByText("25 km")).toBeInTheDocument();
  });

  it("klik + woła onInc, klik − woła onDec", async () => {
    const { onDec, onInc } = ustaw();
    await userEvent.click(
      screen.getByRole("button", { name: "Zwiększ Cel tygodniowy" }),
    );
    expect(onInc).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Zmniejsz Cel tygodniowy" }),
    );
    expect(onDec).toHaveBeenCalledTimes(1);
  });

  it("decDisabled i incDisabled wyłączają przyciski", async () => {
    const { onDec } = ustaw({ decDisabled: true, incDisabled: true });
    const minus = screen.getByRole("button", {
      name: "Zmniejsz Cel tygodniowy",
    });
    expect(minus).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Zwiększ Cel tygodniowy" }),
    ).toBeDisabled();
    await userEvent.click(minus);
    expect(onDec).not.toHaveBeenCalled();
  });

  it("przyciski na telefonie mają fokus wewnątrz (ramka z overflow-hidden go nie utnie)", () => {
    ustaw();
    for (const nazwa of ["Zmniejsz Cel tygodniowy", "Zwiększ Cel tygodniowy"]) {
      expect(screen.getByRole("button", { name: nazwa })).toHaveClass(
        "max-[799px]:focus-visible:shadow-focus-inset",
      );
    }
  });

  it("wide: jedna ramka na pełną szerokość, wartość bez font-mono", () => {
    ustaw({ wide: true });
    const grupa = screen.getByRole("group", { name: "Cel tygodniowy" });
    expect(grupa).toHaveClass("h-8", "w-full", "border", "overflow-hidden");
    const wartosc = screen.getByText("25 km");
    expect(wartosc).toHaveClass("tabular-nums", "flex-1", "justify-center");
    expect(wartosc).not.toHaveClass("font-mono");
    expect(
      screen.getByRole("button", { name: "Zmniejsz Cel tygodniowy" }),
    ).toHaveClass("border-r");
    expect(
      screen.getByRole("button", { name: "Zwiększ Cel tygodniowy" }),
    ).toHaveClass("border-l");
  });

  it("domyślny wariant bez zmian", () => {
    ustaw();
    expect(screen.getByRole("group", { name: "Cel tygodniowy" }).className).toBe(
      "flex items-center gap-1.5 max-[799px]:inline-flex max-[799px]:gap-0 max-[799px]:overflow-hidden max-[799px]:rounded-md max-[799px]:border max-[799px]:border-input max-[799px]:shadow-xs",
    );
    expect(screen.getByText("25 km").className).toBe(
      "inline-flex h-7 min-w-16 items-center justify-center rounded-md border border-input bg-white px-3 font-mono text-sm text-foreground shadow-xs max-[799px]:h-11 max-[799px]:min-w-12 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-2 max-[799px]:font-sans max-[799px]:tabular-nums max-[799px]:shadow-none",
    );
  });
});
