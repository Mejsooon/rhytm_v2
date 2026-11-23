import { describe, expect, it } from "vitest";

import { ICON_KEYWORDS, parsePageIcon, searchIcons } from "./page-icons";
import { pageIconSchema } from "./schemas";

// Mały „cały zestaw” do testów wyszukiwania (zamiast 2000 nazw z lucide-react/dynamic)
const ALL = ["arrow-up", "arrow-down", "arrow-left", "arrow-right", "arrow-big-up", "arrows-up-from-line", "book-open", "book", "rocket", "table"];

describe("ICON_KEYWORDS", () => {
  it("ok. 60 polecanych ikon, nazwy bez duplikatów, w poprawnym formacie", () => {
    expect(ICON_KEYWORDS.length).toBeGreaterThanOrEqual(55);
    expect(ICON_KEYWORDS.length).toBeLessThanOrEqual(65);
    const nazwy = ICON_KEYWORDS.map(([n]) => n);
    expect(new Set(nazwy).size).toBe(nazwy.length);
    for (const n of nazwy) expect(parsePageIcon(`lucide:${n}`)).toBe(n);
  });

  it("zawiera ikony z mapy emoji z migracji i szablonów", () => {
    const nazwy = ICON_KEYWORDS.map(([n]) => n);
    for (const n of ["book-open", "wallet", "lock", "rocket", "globe", "table"]) expect(nazwy).toContain(n);
  });
});

describe("parsePageIcon", () => {
  it("lucide:<nazwa> → nazwa", () => {
    expect(parsePageIcon("lucide:book-open")).toBe("book-open");
    expect(parsePageIcon("lucide:gamepad-2")).toBe("gamepad-2");
  });

  it("stary format z kolorem, emoji, puste i śmieci → null", () => {
    for (const zle of ["lucide:star:gray", "📚", "", "▦", "lucide:", "lucide:Star", "lucide:a--b", "lucide:-a", "abc"]) {
      expect(parsePageIcon(zle)).toBeNull();
    }
  });
});

describe("searchIcons", () => {
  it("puste zapytanie → polecane ikony", () => {
    expect(searchIcons("", ["a", "b"], 120).names).toEqual(ICON_KEYWORDS.map(([n]) => n));
    expect(searchIcons("   ", ["a", "b"], 120).more).toBe(false);
  });

  it("polskie słowa (bez wielkości liter i polskich znaków) idą przed nazwą", () => {
    expect(searchIcons("książ", ALL, 120).names[0]).toBe("book-open");
    expect(searchIcons("KSIAZ", ALL, 120).names[0]).toBe("book-open");
  });

  it("podciąg nazwy z całego zestawu, bez duplikatów, trafienia ze słów przed trafieniami z nazwy", () => {
    const { names } = searchIcons("rocket", ALL, 120);
    expect(names).toEqual(["rocket"]);
    const book = searchIcons("book", ALL, 120).names;
    expect(book).toEqual([...new Set(book)]);
    expect(book).toContain("book");
    expect(book).toContain("book-open");
  });

  it("limit: więcej trafień niż limit → more=true i dokładnie limit nazw", () => {
    const wynik = searchIcons("arrow", ALL, 5);
    expect(wynik).toEqual({ names: expect.any(Array), more: true });
    expect(wynik.names).toHaveLength(5);
    expect(searchIcons("arrow", ALL, 120).more).toBe(false);
  });

  it("brak trafień → pusta lista", () => {
    expect(searchIcons("xyzxyz", ALL, 120)).toEqual({ names: [], more: false });
  });
});

describe("pageIconSchema", () => {
  it("'' i lucide:<nazwa> przechodzą; emoji, kolor i za długie nie", () => {
    expect(pageIconSchema.safeParse("").success).toBe(true);
    expect(pageIconSchema.safeParse("lucide:rocket").success).toBe(true);
    expect(pageIconSchema.safeParse("📚").success).toBe(false);
    expect(pageIconSchema.safeParse("lucide:star:gray").success).toBe(false);
    expect(pageIconSchema.safeParse(`lucide:${"a".repeat(60)}`).success).toBe(false);
  });
});
