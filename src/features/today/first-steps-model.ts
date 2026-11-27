// „Pierwsze kroki”: krok zrobiony = ręczny wybór użytkownika, a bez niego to, co widać w danych.
export const FIRST_STEP_KEYS = ["profil", "blok", "nawyk", "trening", "push", "strona"] as const;

export type FirstStepKey = (typeof FIRST_STEP_KEYS)[number];

export function firstStepsDone(
  marks: unknown,
  fromData: Record<FirstStepKey, boolean>,
): Record<FirstStepKey, boolean> {
  const reczne = (marks ?? {}) as Record<string, unknown>;
  const wynik = { ...fromData };
  for (const k of FIRST_STEP_KEYS) {
    if (typeof reczne[k] === "boolean") wynik[k] = reczne[k];
  }
  return wynik;
}
