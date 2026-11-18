import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("klik woła onChange(!checked); aria-checked odzwierciedla stan", async () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <Checkbox
        checked={false}
        onChange={onChange}
        label="Akceptuję regulamin"
      />,
    );
    const cb = screen.getByRole("checkbox", { name: "Akceptuję regulamin" });
    expect(cb).toHaveAttribute("aria-checked", "false");
    await userEvent.click(cb);
    expect(onChange).toHaveBeenLastCalledWith(true);
    rerender(
      <Checkbox checked onChange={onChange} label="Akceptuję regulamin" />,
    );
    expect(screen.getByRole("checkbox")).toHaveAttribute(
      "aria-checked",
      "true",
    );
    await userEvent.click(screen.getByRole("checkbox"));
    expect(onChange).toHaveBeenLastCalledWith(false);
  });

  it("działa z samym ariaLabel", () => {
    render(
      <Checkbox checked={false} onChange={() => {}} ariaLabel="Zaznacz" />,
    );
    expect(
      screen.getByRole("checkbox", { name: "Zaznacz" }),
    ).toBeInTheDocument();
  });
});
