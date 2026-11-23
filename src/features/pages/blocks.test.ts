import { describe, expect, it } from "vitest";
import { filterSlash, QUICK_START, SLASH_ITEMS } from "./blocks";

describe("menu „/”", () => {
  it("ma 5 pozycji w kolejności z EmptyPage", () => {
    expect(SLASH_ITEMS.map((i) => i.name)).toEqual([
      "Tabela",
      "Lista zadań",
      "Nagłówek",
      "Tekst",
      "Separator",
    ]);
    expect(SLASH_ITEMS.map((i) => i.type)).toEqual(["table", "todo", "heading", "text", "divider"]);
  });

  it("filterSlash szuka bez wielkości liter i polskich znaków", () => {
    expect(filterSlash("tab").map((i) => i.name)).toEqual(["Tabela"]);
    expect(filterSlash("LISTA").map((i) => i.name)).toEqual(["Lista zadań"]);
    expect(filterSlash("naglowek").map((i) => i.name)).toEqual(["Nagłówek"]);
    expect(filterSlash("Nagłówek").map((i) => i.name)).toEqual(["Nagłówek"]);
    expect(filterSlash("xyz")).toEqual([]);
  });

  it("filterSlash szuka też w opisie, a pusty tekst zwraca wszystko", () => {
    expect(filterSlash("odhaczenia").map((i) => i.name)).toEqual(["Lista zadań"]);
    expect(filterSlash("")).toEqual(SLASH_ITEMS);
  });

  it("QUICK_START to 4 chipy", () => {
    expect(QUICK_START.map((q) => q.label)).toEqual(["Tabela", "Lista zadań", "Nagłówek", "Tekst"]);
    expect(QUICK_START.map((q) => q.icon)).toEqual(["▦", "✓", "H", "¶"]);
  });
});
