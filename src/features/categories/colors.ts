// 8 kolorów kategorii — skopiowane z makiety CategoryDialog.dc.html (nazwa + hex).
export const CATEGORY_COLORS = [
  { name: "Niebieski", hex: "#0070f3" },
  { name: "Zielony", hex: "#15803d" },
  { name: "Fioletowy", hex: "#7c3aed" },
  { name: "Pomarańczowy", hex: "#c2410c" },
  { name: "Czerwony", hex: "#b91c1c" },
  { name: "Morski", hex: "#0e7490" },
  { name: "Musztardowy", hex: "#a16207" },
  { name: "Grafitowy", hex: "#525252" },
] as const;

// Same wartości hex — do walidacji koloru w akcjach
export const CATEGORY_COLOR_VALUES: string[] = CATEGORY_COLORS.map((c) => c.hex);
