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
      "focus-visible:shadow-focus",
    );
  });

  it("pokazuje datę z dniem tygodnia albo placeholder", () => {
    ustaw();
    expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent(
      /^pt 20\.11\.2026$/,
    );
  });

  it("skróty dni tygodnia: pn wt śr czw pt sob nd", () => {
    const dni: [string, string][] = [
      ["2026-11-16", "pn 16.11.2026"],
      ["2026-11-17", "wt 17.11.2026"],
      ["2026-11-18", "śr 18.11.2026"],
      ["2026-11-19", "czw 19.11.2026"],
      ["2026-11-20", "pt 20.11.2026"],
      ["2026-11-21", "sob 21.11.2026"],
      ["2026-11-22", "nd 22.11.2026"],
    ];
    for (const [data, tekst] of dni) {
      const { unmount } = render(
        <DatePicker value={data} onChange={vi.fn()} today="2026-11-16" ariaLabel="Termin" />,
      );
      expect(screen.getByRole("button", { name: "Termin" })).toHaveTextContent(
        new RegExp(`^${tekst}$`),
      );
      unmount();
    }
  });

  it("wyzwalacz jak .igroup z CBlockDialog: ikona kalendarza po lewej, tekst sans bez strzałki", () => {
    ustaw("2026-11-17");
    const przycisk = screen.getByRole("button", { name: "Termin" });
    // .igroup: 32 px, ramka input, promień 10 px, cień xs, odstęp 8 px, ikona w kolorze muted
    expect(przycisk).toHaveClass(
      "h-8",
      "gap-2",
      "border-input",
      "rounded-md",
      "shadow-xs",
      "px-[11px]",
      "max-[799px]:h-11",
    );
    const ikony = przycisk.querySelectorAll("svg");
    expect(ikony).toHaveLength(1);
    expect(ikony[0]).toHaveAttribute("aria-hidden", "true");
    expect(przycisk.firstElementChild?.tagName.toLowerCase()).toBe("svg");
    expect(przycisk.querySelector(".font-mono")).toBeNull();
    expect(przycisk.className).not.toContain("font-mono");
  });

  it("className rozszerza wyzwalacz (pełna szerokość w oknie bloku)", () => {
    render(
      <DatePicker value="2026-11-17" onChange={vi.fn()} ariaLabel="Termin" className="w-full" />,
    );
    expect(screen.getByRole("button", { name: "Termin" })).toHaveClass("w-full");
  });

  it("rozmiar sm: 28 px, ikona i data z dniem tygodnia sans", () => {
    render(
      <DatePicker value="2026-11-17" onChange={vi.fn()} ariaLabel="Termin" size="sm" />,
    );
    const przycisk = screen.getByRole("button", { name: "Termin" });
    expect(przycisk).toHaveClass("h-7");
    expect(przycisk).toHaveTextContent(/^wt 17\.11\.2026$/);
    expect(przycisk.querySelector("svg")).not.toBeNull();
    expect(przycisk.className).not.toContain("font-mono");
  });

  it("wariant „bare” (komórka tabeli): sama data bezszeryfowa z cyframi tabelarycznymi, bez ikony (S2Books)", () => {
    render(
      <DatePicker value="2026-11-17" onChange={vi.fn()} ariaLabel="Termin" variant="bare" />,
    );
    const przycisk = screen.getByRole("button", { name: "Termin" });
    expect(przycisk).toHaveTextContent(/^17\.11\.2026$/);
    expect(przycisk.querySelector(".font-mono")).toBeNull();
    expect(screen.getByText("17.11.2026")).toHaveClass("tabular-nums", "truncate");
    expect(przycisk.querySelector("svg")).toBeNull();
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
