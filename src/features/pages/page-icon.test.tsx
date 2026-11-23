import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageIcon } from "./page-icon";
import { ICON_KEYWORDS, IKONY_POLECANE } from "./page-icons";

describe("PageIcon", () => {
  it("nieprawidłowy zapis → od razu ikona tabeli (svg lucide-table), bez błędu w konsoli", () => {
    const { container } = render(<PageIcon icon="xyz" size={16} />);
    expect(container.querySelector("svg.lucide-table")).not.toBeNull();
    expect(container.querySelector("[data-page-icon]")?.getAttribute("data-page-icon")).toBe("table");
  });

  it("pusty zapis i stare emoji → tabela", () => {
    for (const stary of ["", "📚", "lucide:rocket:blue"]) {
      const { container, unmount } = render(<PageIcon icon={stary} size={16} />);
      expect(container.querySelector("svg.lucide-table")).not.toBeNull();
      unmount();
    }
  });

  it("lucide:<nazwa> → wrapper z nazwą; do czasu załadowania ikony widać tabelę (fallback)", () => {
    const { container } = render(<PageIcon icon="lucide:rocket" size={18} />);
    const wrapper = container.querySelector("[data-page-icon]");
    expect(wrapper?.getAttribute("data-page-icon")).toBe("rocket");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("polecana ikona (lucide:book-open) od pierwszego renderu to svg lucide-book-open, bez tabeli", () => {
    const { container } = render(<PageIcon icon="lucide:book-open" size={16} />);
    expect(container.querySelector("svg.lucide-book-open")).not.toBeNull();
    expect(container.querySelector("svg.lucide-table")).toBeNull();
  });

  it("każda nazwa z ICON_KEYWORDS ma wpis w IKONY_POLECANE", () => {
    for (const [nazwa] of ICON_KEYWORDS) expect(IKONY_POLECANE[nazwa], nazwa).toBeDefined();
  });
});
