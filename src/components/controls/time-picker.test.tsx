import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TimePicker } from "./time-picker";

function ustaw() {
  const onChange = vi.fn();
  render(
    <TimePicker
      value="12:00"
      onChange={onChange}
      ariaLabel="Godzina przypomnienia"
    />,
  );
  return onChange;
}

describe("TimePicker", () => {
  it("klik godziny zmienia godzinę i zostawia dymek", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(
      screen.getByRole("button", { name: "Godzina przypomnienia" }),
    );
    await u.click(screen.getByRole("button", { name: "09" }));
    expect(onChange).toHaveBeenCalledWith("09:00");
    expect(screen.getByText("Minuty")).toBeInTheDocument();
  });

  it("klik minut zmienia minuty i zamyka", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(
      screen.getByRole("button", { name: "Godzina przypomnienia" }),
    );
    await u.click(screen.getByRole("button", { name: ":35" }));
    expect(onChange).toHaveBeenCalledWith("12:35");
    expect(screen.queryByText("Minuty")).not.toBeInTheDocument();
  });

  it("Gotowe zamyka bez zmian", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(
      screen.getByRole("button", { name: "Godzina przypomnienia" }),
    );
    await u.click(screen.getByRole("button", { name: "Gotowe" }));
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.queryByText("Minuty")).not.toBeInTheDocument();
  });

  it("tryb 12 h: siatka 1–12 i AM/PM, wybór 2 + PM + :30 daje 14:30", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker
        value="09:00"
        onChange={onChange}
        ariaLabel="Od"
        clock="12"
      />,
    );
    // Przycisk pokazuje godzinę w 12 h
    const przycisk = screen.getByRole("button", { name: "Od" });
    expect(przycisk).toHaveTextContent("9:00 AM");
    await u.click(przycisk);
    expect(
      screen.queryByRole("button", { name: "13" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "00" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "12" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AM" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await u.click(screen.getByRole("button", { name: "2" }));
    expect(onChange).toHaveBeenLastCalledWith("02:00");
    rerender(
      <TimePicker
        value="02:00"
        onChange={onChange}
        ariaLabel="Od"
        clock="12"
      />,
    );
    await u.click(screen.getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("14:00");
    rerender(
      <TimePicker
        value="14:00"
        onChange={onChange}
        ariaLabel="Od"
        clock="12"
      />,
    );
    await u.click(screen.getByRole("button", { name: ":30" }));
    expect(onChange).toHaveBeenLastCalledWith("14:30");
  });

  it("tryb 12 h: 12 AM to 00:00, 12 PM to 12:00", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(
      <TimePicker
        value="05:15"
        onChange={onChange}
        ariaLabel="Od"
        clock="12"
      />,
    );
    await u.click(screen.getByRole("button", { name: "Od" }));
    await u.click(screen.getByRole("button", { name: "12" }));
    expect(onChange).toHaveBeenLastCalledWith("00:15");
    await u.click(screen.getByRole("button", { name: "PM" }));
    expect(onChange).toHaveBeenLastCalledWith("17:15");
  });

  it("allowEndOfDay dodaje „24:00” i pokazuje je na przycisku", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker
        value="23:00"
        onChange={onChange}
        ariaLabel="Do"
        allowEndOfDay
      />,
    );
    await u.click(screen.getByRole("button", { name: "Do" }));
    await u.click(screen.getByRole("button", { name: "24:00" }));
    expect(onChange).toHaveBeenCalledWith("24:00");
    rerender(
      <TimePicker
        value="24:00"
        onChange={onChange}
        ariaLabel="Do"
        allowEndOfDay
      />,
    );
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "24:00",
    );
  });

  it("bez allowEndOfDay nie ma „24:00”", async () => {
    const u = userEvent.setup();
    ustaw();
    await u.click(
      screen.getByRole("button", { name: "Godzina przypomnienia" }),
    );
    expect(
      screen.queryByRole("button", { name: "24:00" }),
    ).not.toBeInTheDocument();
  });

  it("allowEndOfDay w trybie 12 h: opcja i przycisk pokazują 12:00 AM, wartość to 24:00", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    const { rerender } = render(
      <TimePicker
        value="23:00"
        onChange={onChange}
        ariaLabel="Do"
        clock="12"
        allowEndOfDay
      />,
    );
    await u.click(screen.getByRole("button", { name: "Do" }));
    await u.click(screen.getByRole("button", { name: "12:00 AM" }));
    expect(onChange).toHaveBeenCalledWith("24:00");
    rerender(
      <TimePicker
        value="24:00"
        onChange={onChange}
        ariaLabel="Do"
        clock="12"
        allowEndOfDay
      />,
    );
    expect(screen.getByRole("button", { name: "Do" })).toHaveTextContent(
      "12:00 AM",
    );
  });
});

describe("TimePicker — disabled", () => {
  it("wyłączony nie otwiera dymka", async () => {
    const u = userEvent.setup();
    render(
      <TimePicker
        value="12:00"
        onChange={vi.fn()}
        ariaLabel="Godzina"
        disabled
      />,
    );
    const przycisk = screen.getByRole("button", { name: "Godzina" });
    expect(przycisk).toBeDisabled();
    await u.click(przycisk);
    expect(screen.queryByText("Minuty")).not.toBeInTheDocument();
  });
});

describe("TimePicker — wyzwalacz", () => {
  it("jak .igroup z CBlockDialog: ikona zegara po lewej, godzina sans bez strzałki", () => {
    render(<TimePicker value="10:00" onChange={vi.fn()} ariaLabel="Od" />);
    const przycisk = screen.getByRole("button", { name: "Od" });
    expect(przycisk).toHaveTextContent(/^10:00$/);
    expect(przycisk).toHaveClass(
      "h-8",
      "gap-2",
      "border-input",
      "rounded-md",
      "shadow-xs",
      "px-[11px]",
      "tabular-nums",
      "max-[799px]:h-11",
    );
    expect(przycisk.className).not.toContain("font-mono");
    const ikony = przycisk.querySelectorAll("svg");
    expect(ikony).toHaveLength(1);
    expect(ikony[0]).toHaveAttribute("aria-hidden", "true");
    expect(przycisk.firstElementChild?.tagName.toLowerCase()).toBe("svg");
  });

  it("className rozszerza wyzwalacz (pełna szerokość w oknie bloku)", () => {
    render(
      <TimePicker value="10:00" onChange={vi.fn()} ariaLabel="Od" className="w-full" />,
    );
    expect(screen.getByRole("button", { name: "Od" })).toHaveClass("w-full");
  });
});
