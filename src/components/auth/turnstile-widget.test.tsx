import { act, render, screen } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";

const reset = vi.fn();
let opcje: unknown;
let onSuccess: (() => void) | undefined;

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: forwardRef<
    { reset: () => void },
    { options?: unknown; onSuccess?: () => void }
  >(
    function Turnstile(props, ref) {
      opcje = props.options;
      onSuccess = props.onSuccess;
      useImperativeHandle(ref, () => ({ reset }));
      return <div />;
    },
  ),
}));

import { TurnstileWidget } from "./turnstile-widget";

describe("TurnstileWidget", () => {
  it("używa trybu interaction-only / flexible / light", () => {
    render(<TurnstileWidget />);
    expect(opcje).toMatchObject({
      appearance: "interaction-only",
      size: "flexible",
      theme: "light",
    });
  });

  it("resetuje widżet po zmianie resetKey, ale nie przy pierwszym renderze", () => {
    reset.mockClear();
    const { rerender } = render(<TurnstileWidget resetKey={1} />);
    expect(reset).not.toHaveBeenCalled();
    rerender(<TurnstileWidget resetKey={1} />);
    expect(reset).not.toHaveBeenCalled();
    rerender(<TurnstileWidget resetKey={2} />);
    expect(reset).toHaveBeenCalledTimes(1);
  });

  it("telefon: notka „Weryfikacja zakończona” dopiero po tokenie i tylko z phoneStatus", () => {
    const { rerender } = render(<TurnstileWidget phoneStatus resetKey={1} />);
    expect(screen.queryByText("Weryfikacja zakończona")).toBeNull();
    act(() => onSuccess?.());
    const notka = screen.getByText("Weryfikacja zakończona").closest("div");
    expect(notka).toHaveClass("min-[800px]:hidden");
    expect(screen.getByText("Turnstile")).toBeInTheDocument();
    // Nowy token (reset) chowa notkę do czasu kolejnej weryfikacji
    rerender(<TurnstileWidget phoneStatus resetKey={2} />);
    expect(screen.queryByText("Weryfikacja zakończona")).toBeNull();
    // Bez phoneStatus nic nie widać
    rerender(<TurnstileWidget resetKey={2} />);
    act(() => onSuccess?.());
    expect(screen.queryByText("Weryfikacja zakończona")).toBeNull();
  });
});
