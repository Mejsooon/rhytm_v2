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
    // Web: „Moduły / Kalendarz” — h1 to sam tytuł, w nagłówku ukrytym na telefonie
    const web = naglowki.find((h) =>
      h.closest("header")?.classList.contains("max-[799px]:hidden"),
    );
    expect(web).toBeDefined();
    expect(web).toHaveClass("inline", "text-[#171717]");
    expect(web!.closest("header")).toHaveTextContent("Moduły / Kalendarz");
  });
});
