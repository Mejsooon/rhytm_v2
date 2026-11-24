import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModuleHeader } from "./module-header";
import { SidebarStateProvider } from "./sidebar-state";

describe("ModuleHeader", () => {
  it("web i telefon mają h1 z tytułem modułu (każdy widoczny tylko w swojej szerokości)", () => {
    render(<ModuleHeader title="Kalendarz" />);
    const naglowki = screen.getAllByRole("heading", {
      level: 1,
      name: "Kalendarz",
    });
    expect(naglowki).toHaveLength(2);
    // Web: .topbar z samym tytułem .h-title (bez „Moduły /”) — h1 w nagłówku ukrytym na telefonie
    const web = naglowki.find((h) =>
      h.closest("header")?.classList.contains("max-[799px]:hidden"),
    );
    expect(web).toBeDefined();
    expect(web).toHaveClass("text-lg", "font-semibold", "tracking-[-0.011em]");
    expect(web!.closest("header")).toHaveClass("border-b", "border-border", "px-6", "py-2.5", "min-h-9");
    expect(web!.closest("header")).not.toHaveTextContent("Moduły");
    expect(web!.closest("header")).not.toHaveTextContent("/");
  });

  it("z webParent pokazuje okruszki jak .crumb (CPageMenu): „Strony / Books”", () => {
    render(<ModuleHeader title="Books" webParent="Strony" />);
    const web = screen
      .getAllByRole("heading", { level: 1, name: "Books" })
      .find((h) => h.closest("header")?.classList.contains("max-[799px]:hidden"));
    expect(web).toHaveClass("text-sm", "font-medium", "text-foreground");
    expect(web!.closest("header")).toHaveTextContent("Strony / Books");
  });

  it("webMeta stoi tuż za tytułem, a webAction po prawej (CToday)", () => {
    render(
      <ModuleHeader
        title="Dziś"
        webMeta={<span>wtorek · 17.11.2026</span>}
        webAction={<button type="button">Nowy blok</button>}
      />,
    );
    const meta = screen.getByText("wtorek · 17.11.2026");
    const h1 = screen
      .getAllByRole("heading", { level: 1, name: "Dziś" })
      .find((h) => h.closest("header")?.classList.contains("max-[799px]:hidden"))!;
    // Ta sama lewa grupa co tytuł; przycisk poza nią
    expect(meta.parentElement).toBe(h1.parentElement);
    expect(meta.parentElement).not.toContainElement(
      screen.getByRole("button", { name: "Nowy blok" }),
    );
  });

  it("przy schowanym pasku web ma przycisk „Pokaż pasek boczny” przed tytułem", () => {
    render(
      <SidebarStateProvider initialCollapsed>
        <ModuleHeader title="Dziś" />
      </SidebarStateProvider>,
    );
    const przycisk = screen.getByRole("button", { name: "Pokaż pasek boczny" });
    const tytul = screen
      .getAllByRole("heading", { level: 1, name: "Dziś" })
      .find((h) => h.closest("header")?.classList.contains("max-[799px]:hidden"))!;
    expect(
      przycisk.compareDocumentPosition(tytul) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("przy rozwiniętym pasku web nie ma przycisku „Pokaż pasek boczny”", () => {
    render(
      <SidebarStateProvider initialCollapsed={false}>
        <ModuleHeader title="Dziś" />
      </SidebarStateProvider>,
    );
    expect(screen.queryByRole("button", { name: "Pokaż pasek boczny" })).toBeNull();
  });

  it("telefon: .m-head z .lbl nad tytułem .m-title (CMPages), bez etykiety mono", () => {
    render(<ModuleHeader title="Strony" phoneLabel="Twoje tabele i notatki" />);
    const tel = screen
      .getAllByRole("heading", { level: 1, name: "Strony" })
      .find((h) => h.closest("header")?.classList.contains("min-[800px]:hidden"))!;
    expect(tel).toHaveClass("m-title");
    expect(tel).not.toHaveClass("text-[28px]");
    const naglowek = tel.closest("header")!;
    expect(naglowek).toHaveClass("m-head", "py-1");
    const etykieta = screen.getByText("Twoje tabele i notatki");
    expect(etykieta).toHaveClass("text-xs", "font-medium", "text-muted-foreground");
    expect(etykieta).not.toHaveClass("font-mono");
    expect(etykieta).not.toHaveClass("uppercase");
  });

  it("phoneBack: link 44 px ze strzałką przed tytułem, nazwa z label", () => {
    render(<ModuleHeader title="Nawyk" phoneBack={{ href: "/nawyki", label: "Wstecz" }} />);
    const wstecz = screen.getByRole("link", { name: "Wstecz" });
    expect(wstecz).toHaveAttribute("href", "/nawyki");
    expect(wstecz).toHaveClass("max-[799px]:h-11", "max-[799px]:w-11");
    expect(wstecz.querySelector("svg")).toHaveAttribute("width", "20");
    const tel = screen
      .getAllByRole("heading", { level: 1, name: "Nawyk" })
      .find((h) => h.closest("header")?.classList.contains("min-[800px]:hidden"))!;
    expect(
      wstecz.compareDocumentPosition(tel) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(tel.closest("header")).toHaveClass("px-2");
  });

  it("phoneActions po prawej, ⚙ (phoneSettingsLink) jako pierwsza akcja", () => {
    render(
      <ModuleHeader
        title="Strony"
        phoneSettingsLink
        phoneActions={<button type="button">Nowa strona</button>}
      />,
    );
    const ustawienia = screen.getByRole("link", { name: "Ustawienia" });
    expect(ustawienia).toHaveAttribute("href", "/ustawienia");
    expect(ustawienia).toHaveClass("max-[799px]:h-11", "max-[799px]:w-11");
    const nowa = screen.getByRole("button", { name: "Nowa strona" });
    expect(ustawienia.parentElement).toBe(nowa.parentElement);
    expect(
      ustawienia.compareDocumentPosition(nowa) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    const tel = screen
      .getAllByRole("heading", { level: 1, name: "Strony" })
      .find((h) => h.closest("header")?.classList.contains("min-[800px]:hidden"))!;
    expect(
      tel.compareDocumentPosition(nowa) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("phoneCenterTitle: tytuł na środku, z przeciwwagą 44 px gdy brak akcji (CMSettings)", () => {
    const { container } = render(
      <ModuleHeader
        title="Ustawienia"
        phoneCenterTitle
        phoneBack={{ href: "/dzis", label: "Wstecz" }}
      />,
    );
    const tel = screen
      .getAllByRole("heading", { level: 1, name: "Ustawienia" })
      .find((h) => h.closest("header")?.classList.contains("min-[800px]:hidden"))!;
    expect(tel.parentElement).toHaveClass("text-center");
    expect(container.querySelector("header.m-head > span.w-11")).not.toBeNull();
  });

  it("webOnly: bez nagłówka telefonu", () => {
    render(<ModuleHeader title="Dziś" webOnly />);
    expect(screen.getAllByRole("heading", { level: 1, name: "Dziś" })).toHaveLength(1);
  });
});
