import { describe, expect, it } from "vitest";
import { mapClass, mapSource, RE_HEX_ARB } from "./coss-kolory.mjs";

describe("coss-kolory", () => {
  it("mapuje podstawowe klasy", () => {
    expect(mapClass("text-[#171717]")).toBe("text-foreground");
    expect(mapClass("hover:bg-[#f5f5f5]")).toBe("hover:bg-muted");
    expect(mapClass("max-[799px]:border-[#e0e0e0]")).toBe("max-[799px]:border-input");
    expect(mapClass("focus-visible:ring-[#171717]/20")).toBe("focus-visible:ring-ring/20");
    expect(mapClass("border-b-[#EAEAEA]")).toBe("border-b-border");
    expect(mapClass("rounded-[10px]")).toBe("rounded-md");
    expect(mapClass("rounded-t-[16px]")).toBe("rounded-t-xl");
    expect(mapClass("rounded-[7px]")).toBe("rounded-[7px]");
  });

  it("zostawia kolory poza tabelą", () => {
    expect(mapClass("bg-[#7c3aed]")).toBe("bg-[#7c3aed]");
    expect(mapClass("bg-[var(--x,#171717)]")).toBe("bg-[var(--x,#171717)]");
  });

  it("zmienia tylko klasy w źródle", () => {
    const src =
      'const K = ["#15803d", "#3b82f6"]; <span style={{ background: "#b91c1c" }} className="text-[#b91c1c]" />';
    expect(mapSource(src)).toBe(
      'const K = ["#15803d", "#3b82f6"]; <span style={{ background: "#b91c1c" }} className="text-destructive-foreground" />',
    );
    expect(mapSource('toHaveClass("bg-[#171717]", "text-white")')).toBe(
      'toHaveClass("bg-primary", "text-white")',
    );
  });

  it("wykrywa hex w wartościach arbitralnych (np. shadow), nie ruszając tokenów", () => {
    const wykryj = (z) => Array.from(z.matchAll(RE_HEX_ARB), (m) => m[0]);
    expect(wykryj('className="shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--success)]"')).toEqual([
      "shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--success)]",
    ]);
    expect(wykryj('className="shadow-[0_0_0_2px_var(--background)] bg-primary"')).toEqual([]);
    expect(wykryj('const x = "#fff"; className="p-2"')).toEqual([]);
  });
});
