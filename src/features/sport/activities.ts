// Inne aktywności: rodzaje podstawowe (S2ActivityDialog) z intensywnością MET i liczenie kcal.

export type ActivityKind = { name: string; color: string; hasDistance: boolean; met: number };

export const ACTIVITY_COLORS = [
  "#7c3aed", "#4f46e5", "#2563eb", "#0891b2", "#0d9488", "#65a30d", "#ca8a04", "#dc2626", "#db2777",
];
const DOMYSLNY_KOLOR = ACTIVITY_COLORS[0];
// Własny rodzaj: średnia intensywność
const DOMYSLNE_MET = 5;

// [nazwa, MET, dystans, kolor]
const PODSTAWOWE: [string, number, boolean, string?][] = [
  ["Tenis", 7.3, false, "#65a30d"],
  ["Rower", 7.5, true, "#0891b2"],
  ["Pływanie", 7, true],
  ["Pole dance", 5, false, "#db2777"],
  ["Joga", 2.5, false],
  ["Squash", 12, false],
  ["Padel", 6, false],
  ["Piłka nożna", 7, false],
  ["Koszykówka", 6.5, false],
  ["Wspinaczka", 8, false],
  ["Taniec", 5, false],
  ["Pilates", 3, false],
  ["Boks", 9, false],
  ["Spacer", 3.5, true],
  ["Rolki", 7, true],
  ["Narty", 6, false],
];

export type ActivityKindRow = { name: string; color: string; has_distance: boolean };

// Podstawowe z nadpisanym kolorem, potem własne w kolejności z bazy
export function activityKinds(custom: ActivityKindRow[]): ActivityKind[] {
  const wlasne = new Map(custom.map((k) => [k.name.toLowerCase(), k]));
  const podstawowe = PODSTAWOWE.map(([name, met, hasDistance, color = DOMYSLNY_KOLOR]) => ({
    name,
    met,
    hasDistance,
    color: wlasne.get(name.toLowerCase())?.color ?? color,
  }));
  const nazwy = new Set(podstawowe.map((k) => k.name.toLowerCase()));
  return [
    ...podstawowe,
    ...custom
      .filter((k) => !nazwy.has(k.name.toLowerCase()))
      .map((k) => ({ name: k.name, color: k.color, hasDistance: k.has_distance, met: DOMYSLNE_MET })),
  ];
}

// MET × waga × godziny; bez wagi albo czasu nie liczymy
export function activityKcal(met: number, durationS: number | null, weightKg: number | null): number | null {
  if (durationS === null || weightKg === null) return null;
  return Math.round((met * weightKg * durationS) / 3600);
}
