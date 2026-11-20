import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DatePicker } from "./date-picker";

function ustaw(value: string | null = "2026-11-20") {
  const onChange = vi.fn();
  render(
    <DatePicker
      value={value}
      onChange={onChange}
      today="2026-11-16"
      ariaLabel="Termin"
    />,
  );
  return onChange;
}

describe("DatePicker", () => {
  it("wariant „bare” ma widoczny wskaźnik fokusu z klawiatury (jak inne kontrolki)", () => {
    render(
      <DatePicker value={null} onChange={vi.fn()} today="2026-11-16" ariaLabel="Termin" variant="bare" />,
    );
    const przycisk = screen.getByRole("button", { name: "Termin" });
    expect(przycisk).toHaveClass(
      "focus-visible:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--ring)]",
    );
  });

  it("pokazuje datę albo placeholder", () => {
    ustaw();
    expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent(
      "20.11.2026",
    );
  });

  it("bez wartości pokazuje placeholder", () => {
    ustaw(null);
    expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent(
      "Wybierz datę",
    );
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
    expect(screen.getByRole("button", { name: "16" })).toHaveClass(
      "border-border-strong",
    );
    expect(screen.getByRole("button", { name: "20" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "16" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});

describe("DatePicker — max", () => {
  it("dni po max są zablokowane, wcześniejsze dostępne", async () => {
    const u = userEvent.setup();
    render(
      <DatePicker
        value="2026-11-16"
        onChange={vi.fn()}
        today="2026-11-16"
        max="2026-11-16"
        ariaLabel="Termin"
      />,
    );
    await u.click(screen.getByRole("button", { name: "Termin" }));
    expect(screen.getByRole("button", { name: "17" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "15" })).toBeEnabled();
  });
});

describe("DatePicker — min", () => {
  it("dni przed min są zablokowane, późniejsze dostępne", async () => {
    const u = userEvent.setup();
    render(
      <DatePicker
        value="2026-11-16"
        onChange={vi.fn()}
        today="2026-11-16"
        min="2026-11-10"
        ariaLabel="Termin"
      />,
    );
    await u.click(screen.getByRole("button", { name: "Termin" }));
    expect(screen.getByRole("button", { name: "9" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "10" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "11" })).toBeEnabled();
  });

  it("min i max razem zostawiają tylko dni z zakresu", async () => {
    const u = userEvent.setup();
    const onChange = vi.fn();
    render(
      <DatePicker
        value="2026-11-12"
        onChange={onChange}
        today="2026-11-16"
        min="2026-11-10"
        max="2026-11-14"
        ariaLabel="Termin"
      />,
    );
    await u.click(screen.getByRole("button", { name: "Termin" }));
    expect(screen.getByRole("button", { name: "9" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "15" })).toBeDisabled();
    // „Dziś” (16.11) leży poza zakresem, więc też jest zablokowane
    expect(screen.getByRole("button", { name: "Dziś" })).toBeDisabled();
    await u.click(screen.getByRole("button", { name: "10" }));
    expect(onChange).toHaveBeenCalledWith("2026-11-10");
  });
});
