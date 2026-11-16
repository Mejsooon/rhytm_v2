import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

function ustaw(value: string | null = "2026-11-20") {
  const onChange = vi.fn();
  render(
    <DatePicker value={value} onChange={onChange} today="2026-11-16" ariaLabel="Termin" />,
  );
  return onChange;
}

describe("DatePicker", () => {
  it("pokazuje datę albo placeholder", () => {
    ustaw();
    expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent("20.11.2026");
  });

  it("bez wartości pokazuje placeholder", () => {
    ustaw(null);
    expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent("Wybierz datę");
  });

  it("nawigacja między miesiącami, także przez granicę roku", async () => {
    const u = userEvent.setup();
    ustaw();
    await u.click(screen.getByRole("button", { name: "Termin" }));
    expect(screen.getByText("listopad 2026")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Poprzedni miesiąc" }));
    expect(screen.getByText("październik 2026")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    await u.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    expect(screen.getByText("grudzień 2026")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Następny miesiąc" }));
    expect(screen.getByText("styczeń 2027")).toBeInTheDocument();
  });

  it("klik dnia woła onChange i zamyka dymek", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(screen.getByRole("button", { name: "Termin" }));
    await u.click(screen.getByRole("button", { name: "25" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-25");
    expect(screen.queryByText("listopad 2026")).not.toBeInTheDocument();
  });

  it("Dziś i Wyczyść", async () => {
    const u = userEvent.setup();
    const onChange = ustaw();
    await u.click(screen.getByRole("button", { name: "Termin" }));
    await u.click(screen.getByRole("button", { name: "Dziś" }));
    expect(onChange).toHaveBeenLastCalledWith("2026-11-16");
    await u.click(screen.getByRole("button", { name: "Termin" }));
    await u.click(screen.getByRole("button", { name: "Wyczyść" }));
    expect(onChange).toHaveBeenLastCalledWith(null);
  });

  it("oznacza dziś obwódką, a wybrany dzień aria-pressed", async () => {
    const u = userEvent.setup();
    ustaw();
    await u.click(screen.getByRole("button", { name: "Termin" }));
    expect(screen.getByRole("button", { name: "16" })).toHaveClass("border-[#d4d4d4]");
    expect(screen.getByRole("button", { name: "20" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "16" })).toHaveAttribute("aria-pressed", "false");
  });
});
