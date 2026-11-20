import { describe, expect, it } from "vitest";

import {
  EMOJI,
  ICON_COLORS,
  ICON_NAMES,
  matchesIconQuery,
  parsePageIcon,
  serializePageIcon,
} from "./page-icons";

describe("listy z IconPicker.dc.html", () => {
  it("56 emoji, 37 ikon, 8 kolorów w kolejności z makiety", () => {
    expect(EMOJI).toHaveLength(56);
    expect(ICON_NAMES).toHaveLength(37);
    expect(EMOJI[0]).toEqual(["📚", "książki books czytanie biblioteka"]);
    expect(ICON_NAMES[0]).toEqual(["table", "tabela table"]);
    expect(ICON_NAMES.at(-1)).toEqual(["flag", "flaga cel"]);
    expect(ICON_COLORS.map((k) => [k.key, k.hex, k.label])).toEqual([
      ["gray", "#525252", "Szary"],
      ["blue", "#0070f3", "Niebieski"],
      ["green", "#15803d", "Zielony"],
      ["purple", "#7c3aed", "Fioletowy"],
      ["orange", "#c2410c", "Pomarańczowy"],
      ["red", "#b91c1c", "Czerwony"],
      ["teal", "#0e7490", "Morski"],
      ["yellow", "#a16207", "Żółty"],
    ]);
  });
});

describe("parsePageIcon", () => {
  it("emoji z listy → emoji", () => {
    expect(parsePageIcon("📚")).toEqual({ kind: "emoji", v: "📚" });
    expect(parsePageIcon("⚙️")).toEqual({ kind: "emoji", v: "⚙️" });
  });

  it("lucide:<nazwa>:<kolor> → ikona", () => {
    expect(parsePageIcon("lucide:rocket:blue")).toEqual({ kind: "icon", v: "rocket", color: "blue" });
    expect(parsePageIcon("lucide:book-open:teal")).toEqual({ kind: "icon", v: "book-open", color: "teal" });
  });

  it("puste, nieznana nazwa albo kolor i stare znaczki → null (domyślna ikona)", () => {
    for (const zle of ["", "lucide:rakieta:blue", "lucide:rocket:pink", "lucide:rocket", "lucide::blue", "▦", "★", "⚙", "abc"]) {
      expect(parsePageIcon(zle)).toBeNull();
    }
  });
});

describe("serializePageIcon", () => {
  it("odwrotność parsePageIcon", () => {
    expect(serializePageIcon({ kind: "emoji", v: "📚" })).toBe("📚");
    expect(serializePageIcon({ kind: "icon", v: "globe", color: "teal" })).toBe("lucide:globe:teal");
    expect(serializePageIcon(null)).toBe("");
    expect(parsePageIcon(serializePageIcon({ kind: "icon", v: "key", color: "yellow" }))).toEqual({
      kind: "icon",
      v: "key",
      color: "yellow",
    });
  });
});

describe("matchesIconQuery", () => {
  it("pusta fraza pasuje do wszystkiego", () => {
    expect(matchesIconQuery("książki books", "")).toBe(true);
    expect(matchesIconQuery("książki books", "   ")).toBe(true);
  });

  it("bez polskich znaków i bez wielkości liter", () => {
    expect(matchesIconQuery("książki books czytanie", "ksiazki")).toBe(true);
    expect(matchesIconQuery("książki books czytanie", "KSIĄŻ")).toBe(true);
    expect(matchesIconQuery("pieniądze finanse", "pieniadze")).toBe(true);
    expect(matchesIconQuery("słońce dzień", "slonce")).toBe(true);
    expect(matchesIconQuery("kawa coffee", "herbata")).toBe(false);
  });
});
