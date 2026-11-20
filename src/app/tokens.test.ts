import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

// Wartości z tabeli „Tokeny COSS” (wiążące)
const tokeny: Record<string, string> = {
  background: "#ffffff",
  card: "#ffffff",
  popover: "#ffffff",
  foreground: "#262626",
  "card-foreground": "#262626",
  "popover-foreground": "#262626",
  primary: "#262626",
  "primary-hover": "#3a3a3a",
  "primary-foreground": "#fafafa",
  "soft-foreground": "rgba(38,38,38,.8)",
  "muted-foreground": "#686868",
  meta: "#686868",
  "faint-foreground": "rgba(104,104,104,.72)",
  muted: "rgba(0,0,0,.04)",
  accent: "rgba(0,0,0,.04)",
  secondary: "rgba(0,0,0,.04)",
  hover: "rgba(0,0,0,.04)",
  active: "rgba(0,0,0,.06)",
  panel: "#fafafa",
  sidebar: "#fafafa",
  "accent-foreground": "#262626",
  "secondary-foreground": "#262626",
  border: "rgba(0,0,0,.08)",
  "border-soft": "rgba(0,0,0,.06)",
  "sidebar-border": "rgba(0,0,0,.06)",
  input: "rgba(0,0,0,.1)",
  "border-strong": "rgba(0,0,0,.16)",
  ring: "#a3a3a3",
  destructive: "#ef4444",
  "destructive-hover": "#f05252",
  "destructive-foreground": "#b91c1c",
  "destructive-soft": "rgba(239,68,68,.08)",
  "destructive-border": "rgba(239,68,68,.24)",
  success: "#15803d",
  "accent-brand": "#15803d",
  "success-soft": "rgba(21,128,61,.08)",
  "success-border": "rgba(21,128,61,.24)",
  info: "#3b82f6",
  "info-foreground": "#1d4ed8",
  "info-soft": "rgba(59,130,246,.08)",
  "info-border": "rgba(59,130,246,.24)",
  warning: "#f59e0b",
  "warning-foreground": "#b45309",
  "warning-soft": "rgba(245,158,11,.08)",
  "warning-border": "rgba(245,158,11,.28)",
};

const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/,/g, ",\\s*");

// Tokeny COSS muszą występować w globals.css dokładnie z tymi wartościami
describe("tokeny globals.css", () => {
  it("tokeny COSS w :root", () => {
    for (const [nazwa, wartosc] of Object.entries(tokeny)) {
      expect(css, nazwa).toMatch(new RegExp(`--${nazwa}:\\s*${esc(wartosc)};`));
    }
    expect(css).toMatch(/--radius:\s*10px;/);
  });

  it("@theme mapuje tokeny i promienie", () => {
    for (const nazwa of Object.keys(tokeny)) {
      expect(css, nazwa).toContain(`--color-${nazwa}: var(--${nazwa})`);
    }
    expect(css).toContain("--radius-sm: 6px");
    expect(css).toContain("--radius-md: var(--radius)");
    expect(css).toContain("--radius-lg: 12px");
    expect(css).toContain("--radius-xl: 16px");
    expect(css).toContain("--shadow-xs: 0 1px 2px rgba(0, 0, 0, .05)");
    expect(css).toMatch(/--shadow-lg:\s*0 10px 15px -3px rgba\(0, 0, 0, \.06\),\s*0 4px 6px -4px rgba\(0, 0, 0, \.06\)/);
    expect(css).toMatch(/--shadow-pop:[^;]*0 24px 48px -12px rgba\(0, 0, 0, \.14\)/);
    expect(css).toContain('--font-sans: "Inter Variable"');
    expect(css).toContain('font-feature-settings: "cv11"');
  });

  it("--tabbar-h: 56 px treści paska + max(8 px, safe-area)", () => {
    expect(css).toMatch(
      /--tabbar-h:\s*calc\(56px \+ max\(8px, env\(safe-area-inset-bottom\)\)\)/,
    );
  });

  it("nie ma ciemnego motywu", () => {
    expect(css).not.toMatch(/\.dark|prefers-color-scheme/);
  });

  it("html bez nadpisanego font-size (rem zostaje 16 px), body ma 14 px", () => {
    const html = css.match(/(?:^|\s)html\s*\{([^}]*)\}/)?.[1] ?? "";
    const body = css.match(/(?:^|\s)body\s*\{([^}]*)\}/)?.[1] ?? "";
    expect(html).not.toMatch(/font-size/);
    expect(body).toMatch(/font-size:\s*14px/);
  });
});
