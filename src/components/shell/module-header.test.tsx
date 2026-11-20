import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ModuleHeader } from "./module-header";

describe("ModuleHeader", () => {
  it("web i telefon mają h1 z tytułem modułu (każdy widoczny tylko w swojej szerokości)", () => {
    render(<ModuleHeader title="Kalendarz" />);
    const naglowki = screen.getAllByRole("heading", {
      level: 1,
      name: "Kalendarz",
    });
    expect(naglowki).toHaveLength(2);
    // Web: .topbar z CToday — sam tytuł .h-title (18 px / 600), w nagłówku ukrytym na telefonie
    const web = naglowki.find((h) =>
      h.closest("header")?.classList.contains("max-[799px]:hidden"),
    );
    expect(web).toBeDefined();
    expect(web).toHaveClass("text-lg", "font-semibold", "text-foreground");
    expect(web!.closest("header")).toHaveClass("border-b", "border-border", "px-6", "py-2.5", "min-h-9");
    expect(web!.closest("header")).toHaveTextContent(/^Kalendarz$/);
  });

  it("z webParent pokazuje okruszki jak .crumb (CPageMenu): „Strony / Books”", () => {
    render(<ModuleHeader title="Books" webParent="Strony" />);
    const web = screen
      .getAllByRole("heading", { level: 1, name: "Books" })
      .find((h) => h.closest("header")?.classList.contains("max-[799px]:hidden"));
    expect(web).toHaveClass("text-sm", "font-medium", "text-foreground");
    expect(web!.closest("header")).toHaveTextContent("Strony / Books");
  });
});
