// Prośba o otwarcie okna na Dziś (z ⌘K i skrótów). Znacznik w sessionStorage sprawia, że sam adres
// otwarty z zewnątrz nie utworzy treningu.
export const QUICK_ACTIONS = ["blok", "dodaj", "trening", "aktywnosc", "nawyk"] as const;

export type QuickAction = (typeof QUICK_ACTIONS)[number];

const KLUCZ = "rhytm_szybko";

export function quickHref(akcja: QuickAction, tekst = ""): string {
  try {
    sessionStorage.setItem(KLUCZ, tekst);
  } catch {
    // Zablokowany magazyn: okno się otworzy, bez tekstu
  }
  return `/dzis?szybko=${akcja}`;
}

// Tekst prośby albo null, gdy nikt w aplikacji o nic nie prosił
export function takeQuickRequest(): string | null {
  try {
    const tekst = sessionStorage.getItem(KLUCZ);
    sessionStorage.removeItem(KLUCZ);
    return tekst;
  } catch {
    return null;
  }
}
