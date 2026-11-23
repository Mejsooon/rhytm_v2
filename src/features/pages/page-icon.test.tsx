import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageIcon } from "./page-icon";

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
});
