import { render } from "@testing-library/react";
import { forwardRef, useImperativeHandle } from "react";
import { describe, expect, it, vi } from "vitest";

const reset = vi.fn();
let opcje: unknown;

vi.mock("@marsidev/react-turnstile", () => ({
  Turnstile: forwardRef<{ reset: () => void }, { options?: unknown }>(
    function Turnstile(props, ref) {
      opcje = props.options;
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
});
