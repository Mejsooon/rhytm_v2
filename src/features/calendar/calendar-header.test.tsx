import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CalendarHeader } from "./calendar-header";

beforeEach(() => vi.clearAllMocks());

function wyrenderuj(over: Partial<Parameters<typeof CalendarHeader>[0]> = {}) {
  const onNewBlock = vi.fn();
  render(
    <CalendarHeader
      view="tydzien"
      date="2026-11-18"
      today="2026-11-17"
      weekStart="mon"
      onNewBlock={onNewBlock}
      {...over}
    />,
  );
  return { onNewBlock };
}

describe("CalendarHeader", () => {
  it("pokazuje tytuł miesiąca i etykietę tygodnia", () => {
    wyrenderuj();
    expect(screen.getByRole("heading", { name: "Listopad 2026" })).toBeInTheDocument();
    expect(screen.getByText("tydz. 47 · 16–22.11")).toBeInTheDocument();
  });

  it("strzałki i Dziś to linki zmieniające datę", () => {
    wyrenderuj();
    expect(screen.getByRole("link", { name: "Następny tydzień" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=tydzien&data=2026-11-25",
    );
    expect(screen.getByRole("link", { name: "Poprzedni tydzień" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=tydzien&data=2026-11-11",
    );
    expect(screen.getByRole("link", { name: "Dziś" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=tydzien&data=2026-11-17",
    );
  });

  it("segment Dzień zmienia widok w adresie i zachowuje datę", async () => {
    wyrenderuj();
    await userEvent.click(screen.getAllByRole("radio", { name: "Dzień" })[0]);
    expect(push).toHaveBeenCalledWith("/kalendarz?widok=dzien&data=2026-11-18");
  });

  it("zakres tygodnia przechodzący przez miesiące ma obie daty", () => {
    wyrenderuj({ date: "2026-12-02" }); // tydzień 30.11–6.12
    expect(screen.getByText("tydz. 49 · 30.11–6.12")).toBeInTheDocument();
  });

  it("tydzień od niedzieli: etykieta i strzałki", () => {
    wyrenderuj({ weekStart: "sun" }); // 15–21.11, środa 18.11 w tygodniu 47
    expect(screen.getByText("tydz. 47 · 15–21.11")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Następny tydzień" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=tydzien&data=2026-11-25",
    );
    expect(screen.getByRole("link", { name: "Poprzedni tydzień" })).toHaveAttribute(
      "href",
      "/kalendarz?widok=tydzien&data=2026-11-11",
    );
  });

  it("Nowy blok woła callback", async () => {
    const { onNewBlock } = wyrenderuj();
    await userEvent.click(screen.getAllByRole("button", { name: "Nowy blok" })[0]);
    expect(onNewBlock).toHaveBeenCalledTimes(1);
  });
});
