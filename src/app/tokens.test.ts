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
  "destructive-strong": "#dc2626",
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

  it("poziomy heatmapy: heat-1 jasna, heat-2 stonowana zieleń (decyzja 2026-11-20)", () => {
    expect(css).toMatch(/--heat-1:\s*#bbe5cc;/);
    expect(css).toMatch(/--heat-2:\s*#86c99f;/);
    expect(css).toContain("--color-heat-2: var(--heat-2)");
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
    expect(css).toContain("--shadow-btn: 0 1px 2px rgba(0, 0, 0, .05), inset 0 -1px 0 rgba(0, 0, 0, .04)");
    expect(css).toContain("--shadow-card: 0 1px 2px rgba(0, 0, 0, .05), inset 0 -1px 0 rgba(0, 0, 0, .04)");
    expect(css).toContain("--shadow-focus: 0 0 0 2px #fff, 0 0 0 4px var(--ring)");
    expect(css).toContain("--shadow-focus-inset: inset 0 0 0 2px var(--ring)");
    expect(css).toContain("--shadow-halo: 0 0 0 3px color-mix(in srgb, var(--ring) 24%, transparent)");
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

  it("narzędzia CM-BASE telefonu (@utility) z wartościami z makiet CM*", () => {
    const narzedzie = (nazwa: string) => {
      const m = css.match(new RegExp(`@utility ${nazwa} \\{([\\s\\S]*?)\\n\\}`));
      expect(m, nazwa).not.toBeNull();
      return m?.[1] ?? "";
    };
    const wszystkie = ["m-head", "m-title", "m-row", "m-grab", "m-step", "m-fab", "m-hit", "m-stats", "m-stat", "m-stat-v", "m-sec-h", "m-plan-block"];
    for (const n of wszystkie) narzedzie(n);
    expect(narzedzie("m-head")).toContain("min-height: 52px");
    expect(narzedzie("m-head")).toContain("padding: 0 12px 0 16px");
    expect(narzedzie("m-head")).toContain("border-bottom: 1px solid var(--border)");
    expect(narzedzie("m-title")).toContain("font-size: 18px");
    expect(narzedzie("m-title")).toContain("letter-spacing: -.011em");
    expect(narzedzie("m-row")).toContain("min-height: 48px");
    expect(narzedzie("m-row")).toMatch(/&:last-child \{\s*border-bottom: 0;/);
    expect(narzedzie("m-grab")).toContain("width: 36px");
    expect(narzedzie("m-grab")).toContain("background: rgba(0, 0, 0, .14)");
    expect(narzedzie("m-step")).toMatch(/& button \{[^}]*width: 44px;[^}]*height: 44px;/);
    expect(narzedzie("m-step")).toMatch(/& span \{[^}]*min-width: 48px;/);
    expect(narzedzie("m-fab")).toContain("width: 56px");
    expect(narzedzie("m-fab")).toContain("height: 56px");
    expect(narzedzie("m-fab")).toContain("position: fixed");
    expect(narzedzie("m-fab")).toContain("bottom: calc(var(--tabbar-h) + 20px)");
    expect(narzedzie("m-hit")).toMatch(/&::before \{[^}]*inset: -14px;/);
    expect(narzedzie("m-stats")).toContain("grid-template-columns: repeat(2, minmax(0, 1fr))");
    expect(narzedzie("m-stat-v")).toContain("font-size: 22px");
    expect(narzedzie("m-plan-block")).toContain("min-height: 56px");
    // „*/” w środku komentarza (np. ścieżka z gwiazdką) zamyka go za wcześnie i psuje cały arkusz
    expect(css.split("/*").length).toBe(css.split("*/").length);
  });
});
