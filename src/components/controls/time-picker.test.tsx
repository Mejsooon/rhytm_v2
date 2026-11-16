import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimePicker } from "./time-picker";

function ustaw() {
  const onChange = vi.fn();
  render(<TimePicker value="12:00" onChange={onChange} ariaLabel="Godzina przypomnienia" />);
  return onChange;
}

describe("TimePicker", () => {
  it("klik godziny zmienia godzinę i zostawia dymek", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(screen.getByRole("button", { name: "Godzina przypomnienia" }));
    await u.click(screen.getByRole("button", { name: "09" }));
    expect(onChange).toHaveBeenCalledWith("09:00");
    expect(screen.getByText("Minuty")).toBeInTheDocument();
  });

  it("klik minut zmienia minuty i zamyka", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(screen.getByRole("button", { name: "Godzina przypomnienia" }));
    await u.click(screen.getByRole("button", { name: ":35" }));
    expect(onChange).toHaveBeenCalledWith("12:35");
    expect(screen.queryByText("Minuty")).not.toBeInTheDocument();
  });

  it("Gotowe zamyka bez zmian", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(screen.getByRole("button", { name: "Godzina przypomnienia" }));
    await u.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Minuty")).not.toBeInTheDocument();
  });
});
