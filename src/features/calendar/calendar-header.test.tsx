import { render, screen, within } from "@testing-library/react";
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
    // Numer tygodnia w pasku web (obok tytułu h1), nie w nagłówku telefonu
    const pasekWeb = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(pasekWeb).getByText("tydz. 47")).toBeInTheDocument();
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

  it("widok dnia: tytuł z dniem tygodnia i podtytuł „N z M bloków”", () => {
    wyrenderuj({ view: "dzien", date: "2026-11-17", subtitle: "2 z 5 bloków" });
    expect(screen.getByRole("heading", { level: 1, name: "Wtorek, 17 listopada" })).toBeInTheDocument();
    expect(screen.getByText("2 z 5 bloków")).toBeInTheDocument();
  });

  it("widok miesiąca: tytuł miesiąca i podtytuł z liczbą wpisów", () => {
    wyrenderuj({ view: "miesiac", subtitle: "3 wpisy widoczne" });
    expect(screen.getByRole("heading", { level: 1, name: "Listopad 2026" })).toBeInTheDocument();
    expect(screen.getByText("3 wpisy widoczne")).toBeInTheDocument();
  });

  it("jeden pasek: bez okruszków i bez rzędu chipów; jest przycisk „Kategorie”", () => {
    wyrenderuj();
    expect(screen.queryByText("Pokaż")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Kategorie, widoczne \d+ z \d+$/ })).toBeInTheDocument();
    // Telefon: ikona „Kategorie”, bez „+” w nagłówku (nowy blok dodaje pływający przycisk)
    expect(screen.getByRole("button", { name: "Kategorie" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Nowy blok" })).toHaveLength(1);
  });

  it("tydzień od niedzieli: etykieta i strzałki", () => {
    wyrenderuj({ weekStart: "sun" }); // 15–21.11, środa 18.11 w tygodniu 47
    // Numer tygodnia w pasku web (obok tytułu h1), nie w nagłówku telefonu
    const pasekWeb = screen.getByRole("heading", { level: 1 }).closest("header")!;
    expect(within(pasekWeb).getByText("tydz. 47")).toBeInTheDocument();
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
    await userEvent.click(screen.getByRole("button", { name: "Nowy blok" }));
    expect(onNewBlock).toHaveBeenCalledTimes(1);
  });

  it("telefon bierze mobileView: segment i strzałki działają na dniach", async () => {
    wyrenderuj({ mobileView: "dzien" });
    const segmenty = screen.getAllByRole("radiogroup", { name: "Widok kalendarza" });
    expect(segmenty[1].querySelector('[aria-checked="true"]')).toHaveTextContent("Dzień");
    await userEvent.click(screen.getByRole("button", { name: "Następny dzień" }));
    expect(push).toHaveBeenCalledWith("/kalendarz?widok=dzien&data=2026-11-19");
  });
});
