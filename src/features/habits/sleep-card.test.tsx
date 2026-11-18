import { act, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { SleepCard } from "./sleep-card";
import type { SleepLog } from "./sleep";

const SEN: SleepLog[] = [
  { date: "2026-11-16", sleptAt: "23:00", wokeAt: "07:30", feeling: null, tags: [], note: null },
  { date: "2026-11-17", sleptAt: "23:48", wokeAt: "07:00", feeling: 4, tags: [], note: null },
];

const slupki = () => document.querySelectorAll("[data-sleep-bar]");

describe("SleepCard", () => {
  it("ostatnia noc z godzinami i samopoczuciem", () => {
    render(<SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />);
    expect(screen.getByText("Ostatnia noc")).toBeInTheDocument();
    expect(screen.getByText("7:12")).toBeInTheDocument();
    expect(screen.getByText("23:48 → 07:00")).toBeInTheDocument();
    expect(screen.getByText("4/5")).toBeInTheDocument();
  });

  it("zegar 12 h zmienia format godzin", () => {
    render(<SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="12" />);
    expect(screen.getByText("11:48 PM → 7:00 AM")).toBeInTheDocument();
  });

  it("przełącznik 14 / 30 zmienia liczbę słupków", async () => {
    render(<SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />);
    expect(slupki()).toHaveLength(14);
    await userEvent.click(screen.getByRole("radio", { name: "30 dni" }));
    expect(slupki()).toHaveLength(30);
  });

  it("słupek ≥ cel jest ciemny, a dymek pokazuje „dd.mm · h:mm”", () => {
    render(<SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />);
    const powyzej = screen.getByLabelText("16.11 · 8:30");
    const ponizej = screen.getByLabelText("17.11 · 7:12");
    expect(powyzej.className).toContain("bg-[#15803d]");
    expect(ponizej.className).toContain("bg-[#d4d4d4]");
    fireEvent.mouseEnter(powyzej);
    expect(screen.getByRole("tooltip")).toHaveTextContent("16.11 · 8:30");
    expect(screen.getByRole("tooltip").parentElement).toBe(document.body);
    expect(screen.getByText("cel 8 h")).toBeInTheDocument();
  });

  it("bez wpisów ostatnia noc to „—”", () => {
    render(<SleepCard sleepLogs={[]} today="2026-11-17" goalMin={480} clock="24" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText("Samopoczucie")).not.toBeInTheDocument();
  });

  it("słupek z wpisem dostaje fokus i pokazuje dymek", () => {
    render(<SleepCard sleepLogs={SEN} today="2026-11-17" goalMin={480} clock="24" />);
    const slupek = screen.getByLabelText("17.11 · 7:12");
    expect(slupek).toHaveAttribute("tabindex", "0");
    act(() => slupek.focus());
    expect(screen.getByRole("tooltip")).toHaveTextContent("17.11 · 7:12");
  });
});
