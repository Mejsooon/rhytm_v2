// Dane testowe stron z szablonów (wspólne dla testów menu kolumny i filtra)
import type { LoadedPage } from "../load-page";
import type { FieldConfig } from "../fields";
import { buildTemplateBlocks, type TemplateKey } from "../templates";

export const DZIS = "2026-11-15";

// Subscriptions (S2Main.dc.html, wycinek BASE; te same dane co w table-model.test): przy DZIS sumy aktywnych
// to 63,83 zł / mies. i 765,99 zł / rok (Disney+ nieaktywny), najbliższe odnowienie Netflix 21.11.2026 („za 6 dni”)
export const SUBSKRYPCJE: Record<string, unknown>[] = [
  { Nazwa: "Strava", "Kwota cykliczna": { amount: 249.99, cycle: "year" }, "Data odnowienia": "2025-12-03", Kategoria: "Sport", Aktywna: true },
  { Nazwa: "Netflix", "Kwota cykliczna": { amount: 43, cycle: "month" }, "Data odnowienia": "2026-10-21", Kategoria: "Rozrywka", Aktywna: true },
  { Nazwa: "Disney+", "Kwota cykliczna": { amount: 37.99, cycle: "month" }, "Data odnowienia": "2026-11-24", Kategoria: "Rozrywka", Aktywna: false },
];

// Strona z szablonu z wierszami podanymi po nazwach pól i etykietach opcji
export function stronaTestowa(
  key: TemplateKey,
  title: string,
  wiersze: Record<string, unknown>[],
): LoadedPage {
  let n = 0;
  // „Pusta strona” nie ma już tabeli: w testach jej odpowiednik to tabela z samym polem „Nazwa”
  const b =
    key === "empty"
      ? {
          content: { name: "", settings: { sort: [], filters: [], hidden_field_ids: [], column_summaries: {}, pinned_cards: [], column_widths: {} } },
          fields: [{ id: "00000000-0000-4000-8000-000000000001", name: "Nazwa", type: "text" as const, config: { empty_label: "Bez tytułu" } as FieldConfig, is_title: true }],
        }
      : buildTemplateBlocks(key, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`).find((x) => x.type === "table")!;
  const fields = b.fields.map((f, i) => ({
    id: f.id,
    name: f.name,
    type: f.type,
    config: f.config,
    position: i,
    isTitle: f.is_title,
  }));
  const rows = wiersze.map((w, i) => {
    const values: Record<string, unknown> = {};
    for (const [nazwa, v] of Object.entries(w)) {
      const pole = fields.find((f) => f.name === nazwa);
      if (!pole) throw new Error(`Brak pola ${nazwa}`);
      const opcja = pole.config.options?.find((o) => o.label === v);
      values[pole.id] = opcja ? opcja.id : v;
    }
    return { id: `row-${i + 1}`, values, position: i, deletedAt: null };
  });
  return {
    page: {
      id: "p1",
      title,
      icon: "▦",
      favorite: false,
      templateKey: key,
      position: 0,
      rowCount: rows.length,
      createdAt: "2026-11-01T10:00:00Z",
      isSystem: false,
    },
    blocks: [{ id: "blok-1", type: "table", position: 0, content: b.content, fields, rows }],
    today: DZIS,
    currency: "PLN",
  };
}
