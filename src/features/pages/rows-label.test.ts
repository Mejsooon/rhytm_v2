import { describe, expect, it } from "vitest";

import { rowsForm, rowsLabel } from "./rows-label";

describe("rowsLabel", () => {
  it.each([
    [0, "0 wierszy"],
    [1, "1 wiersz"],
    [2, "2 wiersze"],
    [4, "4 wiersze"],
    [5, "5 wierszy"],
    [11, "11 wierszy"],
    [12, "12 wierszy"],
    [14, "14 wierszy"],
    [22, "22 wiersze"],
    [112, "112 wierszy"],
  ])("%i → %s", (n, oczekiwane) => {
    expect(rowsLabel(n)).toBe(oczekiwane);
  });

  it("rowsForm rozróżnia trzy formy", () => {
    expect(rowsForm(1)).toBe("one");
    expect(rowsForm(3)).toBe("few");
    expect(rowsForm(13)).toBe("many");
  });
});
