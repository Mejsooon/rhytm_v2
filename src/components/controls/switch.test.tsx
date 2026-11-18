import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("klik i Spacja przełączają; aria-checked odzwierciedla stan", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Switch checked={false} onChange={onChange} ariaLabel="Powiadomienia" />,
    );
    const sw = screen.getByRole("switch", { name: "Powiadomienia" });
    expect(sw).toHaveAttribute("aria-checked", "false");
    await userEvent.click(sw);
    expect(onChange).toHaveBeenLastCalledWith(true);
    sw.focus();
    await userEvent.keyboard(" ");
    expect(onChange).toHaveBeenCalledTimes(2);
    rerender(<Switch checked onChange={onChange} ariaLabel="Powiadomienia" />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("disabled nie woła onChange", async () => {
    const onChange = vi.fn();
    render(
      <Switch checked={false} disabled onChange={onChange} ariaLabel="X" />,
    );
    await userEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
