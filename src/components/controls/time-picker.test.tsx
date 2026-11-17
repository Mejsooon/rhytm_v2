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

  it("tryb 12 h: siatka 1–12 i AM/PM, wybór 2 + PM + :30 daje 14:30", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker value="09:00" onChange={onChange} ariaLabel="Od" clock="12" />,
    );
    // Przycisk pokazuje godzinę w 12 h
    const przycisk = screen.getByRole("button", { name: "Od" });
    expect(przycisk).toHaveTextContent("9:00 AM");
    await u.click(przycisk);
    expect(screen.queryByRole("button", { name: "13" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "00" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AM" })).toHaveAttribute("aria-pressed", "true");

    await u.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenLastCalledWith("02:00");
    rerender(<TimePicker value="02:00" onChange={onChange} ariaLabel="Od" clock="12" />);
    await u.click(screen.getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("14:00");
    rerender(<TimePicker value="14:00" onChange={onChange} ariaLabel="Od" clock="12" />);
    await u.click(screen.getByRole("button", { name: ":30" }));
    expect(onChange).toHaveBeenLastCalledWith("14:30");
  });

  it("tryb 12 h: 12 AM to 00:00, 12 PM to 12:00", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(<TimePicker value="05:15" onChange={onChange} ariaLabel="Od" clock="12" />);
    await u.click(screen.getByRole("button", { name: "Od" }));
    await u.click(screen.getByRole("button", { name: "12" }));
    expect(onChange).toHaveBeenLastCalledWith("00:15");
    await u.click(screen.getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("17:15");
  });
});
