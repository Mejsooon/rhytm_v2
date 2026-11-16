import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Tokeny ze spec 3.1 muszą występować w globals.css dokładnie z tymi wartościami
const css = readFileSync(path.resolve(__dirname, "globals.css"), "utf8");

const tokeny: Record<string, string> = {
  "--background": "#ffffff",
  "--panel": "#fafafa",
  "--hover": "#f5f5f5",
  "--active": "#f0f0f0",
  "--border": "#eaeaea",
  "--border-strong": "#e0e0e0",
  "--border-soft": "#f0f0f0",
  "--foreground": "#171717",
  "--muted-foreground": "#666666",
  "--meta": "#6b6b6b",
  "--accent-brand": "#15803d",
  "--destructive": "#b91c1c",
  "--primary": "#171717",
  "--primary-foreground": "#ffffff",
};

describe("tokeny globals.css", () => {
  for (const [name, value] of Object.entries(tokeny)) {
    it(`${name} = ${value}`, () => {
      expect(css).toMatch(new RegExp(`${name}:\\s*${value}`, "i"));
    });
  }

  it("nie ma ciemnego motywu", () => {
    expect(css).not.toMatch(/\.dark|prefers-color-scheme/);
  });
});
