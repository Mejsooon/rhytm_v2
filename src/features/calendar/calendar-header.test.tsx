import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { SidebarStateProvider } from "@/components/shell/sidebar-state";
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
    expect(
      screen.getByRole("heading", { name: "Listopad 2026" }),
    ).toBeInTheDocument();
    // Numer tygodnia w pasku web (obok tytułu h1), nie w nagłówku telefonu
    const pasekWeb = screen
      .getByRole("heading", { level: 1 })
      .closest("header")!;
    expect(within(pasekWeb).getByText("tydz. 47 · 16–22 listopada")).toBeInTheDocument();
  });

  it("strzałki i Dziś to linki zmieniające datę", () => {
    wyrenderuj();
    expect(
      screen.getByRole("link", { name: "Następny tydzień" }),
    ).toHaveAttribute("href", "/kalendarz?widok=tydzien&data=2026-11-25");
    expect(
      screen.getByRole("link", { name: "Poprzedni tydzień" }),
    ).toHaveAttribute("href", "/kalendarz?widok=tydzien&data=2026-11-11");
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
    expect(
      screen.getByRole("heading", { level: 1, name: "Wtorek, 17 listopada" }),
    ).toBeInTheDocument();
    expect(screen.getByText("2 z 5 bloków")).toBeInTheDocument();
  });

  it("widok miesiąca: tytuł miesiąca i podtytuł z liczbą wpisów", () => {
    wyrenderuj({ view: "miesiac", subtitle: "3 wpisy widoczne" });
    expect(
      screen.getByRole("heading", { level: 1, name: "Listopad 2026" }),
    ).toBeInTheDocument();
    expect(screen.getByText("3 wpisy widoczne")).toBeInTheDocument();
  });

  it("jeden pasek: bez okruszków i bez menu „Kategorie”, z przyciskiem panelu", () => {
    wyrenderuj();
    expect(screen.queryByText("Pokaż")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Panel kalendarza" })).toHaveAttribute("aria-pressed", "true");
    // Telefon w tygodniu: bez „Kategorie” (jak w makiecie)
    expect(screen.queryByRole("button", { name: /Kategorie/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Nowy blok" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Nowy wpis" })).toHaveLength(1);
  });

  it("tydzień od niedzieli: etykieta i strzałki", () => {
    wyrenderuj({ weekStart: "sun" }); // 15–21.11, środa 18.11 w tygodniu 47
    // Numer tygodnia w pasku web (obok tytułu h1), nie w nagłówku telefonu
    const pasekWeb = screen
      .getByRole("heading", { level: 1 })
      .closest("header")!;
    expect(within(pasekWeb).getByText("tydz. 47 · 15–21 listopada")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Następny tydzień" }),
    ).toHaveAttribute("href", "/kalendarz?widok=tydzien&data=2026-11-25");
    expect(
      screen.getByRole("link", { name: "Poprzedni tydzień" }),
    ).toHaveAttribute("href", "/kalendarz?widok=tydzien&data=2026-11-11");
  });

  it("Nowy blok woła callback", async () => {
    const { onNewBlock } = wyrenderuj();
    await userEvent.click(
      screen.getAllByRole("button", { name: "Nowy blok" })[0],
    );
    expect(onNewBlock).toHaveBeenCalledTimes(1);
  });

  it("telefon: segment to linki z aria-current przy aktualnym widoku; dzień bez strzałek", () => {
    wyrenderuj({ mobileView: "dzien" });
    const nawigacja = screen.getByRole("navigation", {
      name: "Widok kalendarza",
    });
    expect(
      within(nawigacja).getByRole("link", { name: "Dzień" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      within(nawigacja).getByRole("link", { name: "Tydzień" }),
    ).not.toHaveAttribute("aria-current");
    expect(
      within(nawigacja).getByRole("link", { name: "Miesiąc" }),
    ).toHaveAttribute("href", "/kalendarz?widok=miesiac&data=2026-11-18");
    expect(
      screen.queryByRole("button", { name: "Następny dzień" }),
    ).not.toBeInTheDocument();
    // Telefon: „Szukaj” to link do /szukaj, a „Kategorie” otwiera okno
    expect(screen.getByRole("link", { name: "Szukaj" })).toHaveAttribute(
      "href",
      "/szukaj",
    );
    expect(screen.getByRole("button", { name: "Kategorie" })).toHaveAttribute(
      "aria-haspopup",
      "dialog",
    );
  });

  it("telefon: tydzień ma etykietę, zakres dni, Szukaj, Nowy blok i strzałki", async () => {
    const { onNewBlock } = wyrenderuj({ mobileView: "tydzien" });
    expect(screen.getByText("2026 · tydzień 47")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 2, name: "16–22 listopada" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Szukaj" })).toHaveAttribute(
      "href",
      "/szukaj",
    );
    await userEvent.click(screen.getByRole("button", { name: "Nowy wpis" }));
    expect(onNewBlock).toHaveBeenCalledTimes(1);
    await userEvent.click(
      screen.getByRole("button", { name: "Następny tydzień" }),
    );
    expect(push).toHaveBeenCalledWith(
      "/kalendarz?widok=tydzien&data=2026-11-25",
    );
  });

  it("telefon: tydzień na przełomie miesięcy pokazuje oba miesiące", () => {
    wyrenderuj({ mobileView: "tydzien", date: "2026-12-02" });
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "30 listopada – 6 grudnia",
      }),
    ).toBeInTheDocument();
  });

  it("telefon: miesiąc ma etykietę roku, nazwę i strzałki bez Szukaj i Kategorii", async () => {
    wyrenderuj({ mobileView: "miesiac", view: "miesiac" });
    expect(
      screen.getByRole("heading", { level: 2, name: "Listopad" }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Szukaj" })).toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Poprzedni miesiąc" }),
    );
    expect(push).toHaveBeenCalledWith(
      "/kalendarz?widok=miesiac&data=2026-10-18",
    );
  });

  it("przycisk panelu woła onTogglePanel, a Nowy blok to .btnp z ikoną", async () => {
    const onTogglePanel = vi.fn();
    render(<CalendarHeader view="tydzien" date="2026-11-18" today="2026-11-17" weekStart="mon" onTogglePanel={onTogglePanel} />);
    await userEvent.click(screen.getByRole("button", { name: "Panel kalendarza" }));
    expect(onTogglePanel).toHaveBeenCalled();
    const nowy = screen.getAllByRole("button", { name: "Nowy blok" })[0];
    expect(nowy.className).toContain("bg-primary");
    expect(nowy.querySelector("svg")).not.toBeNull();
  });

  it("przy schowanym pasku nagłówek nie ma „Pokaż pasek boczny” (przycisk jest w szynie, S2SidebarCollapsed)", () => {
    render(
      <SidebarStateProvider initialCollapsed>
        <CalendarHeader
          view="tydzien"
          date="2026-11-18"
          today="2026-11-17"
          weekStart="mon"
          onNewBlock={vi.fn()}
        />
      </SidebarStateProvider>,
    );
    expect(
      screen.queryByRole("button", { name: "Pokaż pasek boczny" }),
    ).toBeNull();
  });
});
