// Odmiana „N wierszy” (1 wiersz, 2–4 wiersze, 5+ wierszy; 12–14 → wierszy)
export type RowsForm = "one" | "few" | "many";

export function rowsForm(n: number): RowsForm {
  if (n === 1) return "one";
  const reszta10 = n % 10;
  const reszta100 = n % 100;
  if (reszta10 >= 2 && reszta10 <= 4 && !(reszta100 >= 12 && reszta100 <= 14)) return "few";
  return "many";
}

export function rowsLabel(n: number): string {
  const forma = rowsForm(n);
  if (forma === "one") return `${n} wiersz`;
  if (forma === "few") return `${n} wiersze`;
  return `${n} wierszy`;
}
