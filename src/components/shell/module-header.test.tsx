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
});
