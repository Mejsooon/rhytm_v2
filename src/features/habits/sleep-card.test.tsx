import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SleepCard } from "./sleep-card";
import type { SleepLog } from "./sleep";

const SEN: SleepLog[] = [
  {
    date: "2026-11-16",
    sleptAt: "23:00",
    wokeAt: "07:30",
    feeling: null,
    tags: [],
    note: null,
  },
  {
    date: "2026-11-17",
    sleptAt: "23:48",
    wokeAt: "07:00",
    feeling: 4,
    tags: [],
    note: null,
  },
];

const slupki = () => document.querySelectorAll("[data-sleep-bar]");

describe("SleepCard", () => {
  it("ostatnia noc z godzinami i samopoczuciem", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    expect(screen.getByText("Ostatnia noc")).toBeInTheDocument();
    expect(screen.getByText("7:12")).toBeInTheDocument();
    expect(screen.getByText("23:48 → 07:00")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("zegar 12 h zmienia format godzin", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="12" />,
    );
    expect(screen.getByText("11:48 PM → 7:00 AM")).toBeInTheDocument();
  });

  it("przełącznik 14 / 30 zmienia liczbę słupków", async () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    expect(slupki()).toHaveLength(14);
    await userEvent.click(screen.getByRole("radio", { name: "30 dni" }));
    expect(slupki()).toHaveLength(30);
  });

  it("słupek ≥ cel jest ciemny, a dymek pokazuje „dd.mm · h:mm”", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    const powyzej = screen.getByLabelText("16.11 · 8:30");
    const ponizej = screen.getByLabelText("17.11 · 7:12");
    expect(powyzej.className).toContain("bg-success");
    expect(ponizej.className).toContain("bg-border-strong");
    fireEvent.mouseEnter(powyzej);
    expect(screen.getByRole("tooltip")).toHaveTextContent("16.11 · 8:30");
    expect(screen.getByRole("tooltip").parentElement).toBe(document.body);
    expect(screen.getByText("cel 8 h")).toBeInTheDocument();
  });

  it("bez wpisów ostatnia noc to „—”", () => {
    render(
      <SleepCard sleepLogs={[]} today="2026-11-17" goalMin={480} clock="24" />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Samopoczucie")).not.toBeInTheDocument();
  });

  it("karta snu bez wpisów pokazuje stan pusty", () => {
    render(
      <SleepCard sleepLogs={[]} today="2026-11-17" goalMin={480} clock="24" />,
    );
    // Dotychczasowy stan pusty: „—” zamiast czasu, bez godzin i samopoczucia
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edytuj ostatnią noc/ })).not.toBeInTheDocument();
    // Wykres bez dzielenia przez zero: 14 pustych słupków o wysokości 0, bez fokusu
    expect(slupki()).toHaveLength(14);
    for (const b of slupki()) {
      expect((b as HTMLElement).style.height).toBe("0px");
      expect(b).not.toHaveAttribute("tabindex");
    }
    // Linia celu i podpis „cel 8 h” zostają
    expect(screen.getByText("cel 8 h")).toBeInTheDocument();
    expect(screen.getByText("17.11")).toBeInTheDocument();
  });

  it("karta i wykres jak w makiecie CHabits", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    const karta = screen.getByRole("heading", { name: "Sen" }).closest("section");
    expect(karta).toHaveClass("rounded-xl", "border-border", "shadow-card", "bg-clip-padding");
    expect(screen.getByRole("heading", { name: "Sen" })).toHaveClass("text-base", "font-semibold");
    // Etykiety .lbl (12 px, bez mono), wartości 20 px pogrubione z cyframi tabelarycznymi
    const etykieta = screen.getByText("Ostatnia noc");
    expect(etykieta).toHaveClass("text-xs", "font-medium", "text-muted-foreground");
    expect(etykieta.className).not.toContain("font-mono");
    expect(screen.getByText("7:12")).toHaveClass("text-xl", "font-semibold", "tabular-nums");
    expect(screen.getByText("7:12").className).not.toContain("font-mono");
    expect(screen.getByText("23:48 → 07:00")).toHaveClass("text-xs", "tabular-nums");
    // Podpis celu jako odznaka .bdg.ok
    expect(screen.getByText("cel 8 h")).toHaveClass("bg-success-soft", "text-success", "rounded-sm");
    // Nieprzezroczysta podkładka pod odznaką, by tekst był czytelny nad słupkiem
    expect(screen.getByText("cel 8 h").parentElement).toHaveClass("bg-card");
    // Słupki z zaokrągleniem 4 px u góry
    expect(screen.getByLabelText("17.11 · 7:12")).toHaveClass("rounded-t-[4px]");
    // Oś dat bez mono
    expect(screen.getByText("17.11").parentElement).toHaveClass("text-[11px]", "tabular-nums");
  });

  it("zaznaczony słupek ma pierścień w style, a fokus klawiatury osobny obrys", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    const slupek = screen.getByLabelText("17.11 · 7:12");
    expect(slupek).toHaveClass(
      "focus-visible:outline-solid",
      "focus-visible:outline-2",
      "focus-visible:outline-offset-2",
      "focus-visible:outline-ring",
    );
    expect(slupek.style.boxShadow).toBe("");
    fireEvent.mouseEnter(slupek);
    expect(slupek.style.boxShadow).toContain("var(--foreground)");
    // Dymek .pop: data pogrubiona, czas w drugiej linii
    expect(screen.getByText("17.11", { selector: "[role=tooltip] *" })).toHaveClass("font-semibold");
  });

  it("słupek z wpisem dostaje fokus i pokazuje dymek", () => {
    render(
      <SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />,
    );
    const slupek = screen.getByLabelText("17.11 · 7:12");
    expect(slupek).toHaveAttribute("tabindex", "0");
    act(() => slupek.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent("17.11 · 7:12");
  });
});
