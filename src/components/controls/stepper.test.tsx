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
});
