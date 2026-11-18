import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Segment } from "./segment";

const OPCJE = [
  { value: "mon", label: "Pn" },
  { value: "sun", label: "Nd" },
  { value: "sat", label: "Sb" },
] as const;

function Wrapper({ onChange }: { onChange?: (v: string) => void }) {
  const [v, setV] = useState<"mon" | "sun" | "sat">("mon");
  return (
    <Segment
      ariaLabel="Początek tygodnia"
      value={v}
      options={[...OPCJE]}
      onChange={(n) => {
        setV(n);
        onChange?.(n);
      }}
    />
  );
}

describe("Segment", () => {
  it("klik woła onChange i ustawia aria-checked", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    expect(
      screen.getByRole("radiogroup", { name: "Początek tygodnia" }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole("radio", { name: "Nd" }));
    expect(onChange).toHaveBeenCalledWith("sun");
    expect(screen.getByRole("radio", { name: "Nd" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("radio", { name: "Pn" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("strzałki zmieniają wybór", async () => {
    const onChange = vi.fn();
    render(<Wrapper onChange={onChange} />);
    screen.getByRole("radio", { name: "Pn" }).focus();
    await userEvent.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenLastCalledWith("sun");
    await userEvent.keyboard("{ArrowLeft}");
    expect(onChange).toHaveBeenLastCalledWith("mon");
  });
});
