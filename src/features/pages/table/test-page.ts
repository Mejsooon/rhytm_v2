// Dane testowe stron z szablonów (wspólne dla testów menu kolumny i filtra)
import type { LoadedPage } from "../load-page";
import { buildTemplateBlocks, type TemplateKey } from "../templates";

export const DZIS = "2026-11-15";

// Strona z szablonu z wierszami podanymi po nazwach pól i etykietach opcji
export function stronaTestowa(
  key: TemplateKey,
  title: string,
  wiersze: Record<string, unknown>[],
): LoadedPage {
  let n = 0;
  const [b] = buildTemplateBlocks(key, () => `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`);
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
    },
    blocks: [{ id: "blok-1", type: "table", position: 0, content: b.content, fields, rows }],
    today: DZIS,
    currency: "PLN",
  };
}
