// Biblioteka ćwiczeń: suma list z makiet GymLog i WorkoutTemplates (bez duplikatów wielkości liter).
const GYM_LOG: [string, string][] = [
  ["Wyciskanie żołnierskie", "barki"],
  ["Wyciskanie hantli nad głowę", "barki"],
  ["Rozpiętki na wyciągu", "klatka"],
  ["Wyciskanie wąsko", "triceps"],
  ["Prostowanie ramion na wyciągu", "triceps"],
  ["Francuskie wyciskanie", "triceps"],
  ["Pompki", "klatka"],
  ["Przysiad ze sztangą", "nogi"],
  ["Martwy ciąg", "plecy"],
  ["Podciąganie", "plecy"],
  ["Wiosłowanie sztangą", "plecy"],
  ["Uginanie ramion", "biceps"],
];

const WORKOUT_TEMPLATES: [string, string][] = [
  ["Wyciskanie na ławce", "klatka"],
  ["Wyciskanie hantli skos", "klatka"],
  ["Wyciskanie żołnierskie", "barki"],
  ["Wznosy bokiem", "barki"],
  ["Rozpiętki na wyciągu", "klatka"],
  ["Pompki na poręczach", "triceps"],
  ["Francuskie wyciskanie", "triceps"],
  ["Przysiad", "nogi"],
  ["Martwy ciąg", "plecy"],
  ["Podciąganie", "plecy"],
  ["Wiosłowanie sztangą", "plecy"],
  ["Face pull", "barki"],
  ["Uginanie hantli", "biceps"],
  ["Wykroki", "nogi"],
  ["Hip thrust", "pośladki"],
  ["Plank", "brzuch"],
  ["Dipy", "triceps"],
];

// Ćwiczenia z masą ciała: kg w treningu to wtedy mc (waga z profilu) + opcjonalne dociążenie
const Z_MASA_CIALA = new Set([
  "podciąganie",
  "pompki",
  "pompki na poręczach",
  "dipy",
  "plank",
]);

const widziane = new Set<string>();
export const EXERCISE_LIBRARY: {
  name: string;
  group: string;
  bodyweight: boolean;
  kind: "wr" | "bw" | "dur";
  equipment: string;
}[] = [];

// Sprzęt wynika z nazwy (jak chipy w makiecie); reszta to sztanga
function sprzet(nazwa: string, bodyweight: boolean): string {
  if (bodyweight || nazwa === "hip thrust") return bodyweight ? "Masa ciała" : "Sztanga";
  if (/wyciąg|face pull/.test(nazwa)) return "Wyciąg";
  if (/hantl|wznosy|wykroki|^uginanie ramion$/.test(nazwa)) return "Hantle";
  return "Sztanga";
}
for (const [name, group] of [...GYM_LOG, ...WORKOUT_TEMPLATES]) {
  if (widziane.has(name.toLowerCase())) continue;
  widziane.add(name.toLowerCase());
  const bodyweight = Z_MASA_CIALA.has(name.toLowerCase());
  const czas = name.toLowerCase() === "plank";
  EXERCISE_LIBRARY.push({
    name,
    group,
    // Plank mierzy się czasem, nie ciężarem
    bodyweight: bodyweight && !czas,
    kind: czas ? "dur" : bodyweight ? "bw" : "wr",
    equipment: sprzet(name.toLowerCase(), bodyweight),
  });
}

// Wyniki dymka wyszukiwania: ćwiczenia użytkownika + biblioteka,
// bez już dodanych (excludeNames) i bez duplikatów wielkości liter.
export function searchExercises(
  query: string,
  own: { id: string; name: string; muscle_group: string | null }[],
  excludeNames: string[],
): { name: string; group: string | null; id: string | null }[] {
  const q = query.trim().toLowerCase();
  const wykluczone = new Set(excludeNames.map((n) => n.toLowerCase()));
  const wynik: { name: string; group: string | null; id: string | null }[] = [];
  const uzyte = new Set<string>();

  for (const e of own) {
    const nazwa = e.name.toLowerCase();
    if (wykluczone.has(nazwa) || uzyte.has(nazwa)) continue;
    if (q && !`${nazwa} ${(e.muscle_group ?? "").toLowerCase()}`.includes(q))
      continue;
    uzyte.add(nazwa);
    wynik.push({ name: e.name, group: e.muscle_group, id: e.id });
  }
  for (const l of EXERCISE_LIBRARY) {
    const nazwa = l.name.toLowerCase();
    if (wykluczone.has(nazwa) || uzyte.has(nazwa)) continue;
    if (q && !`${nazwa} ${l.group}`.includes(q)) continue;
    uzyte.add(nazwa);
    wynik.push({ name: l.name, group: l.group, id: null });
  }
  return wynik;
}
