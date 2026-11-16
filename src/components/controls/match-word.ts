// Porównanie wpisanego słowa potwierdzającego: bez znaczenia wielkość liter i spacje
// na brzegach, ale polskie znaki muszą się zgadzać („usun” ≠ „USUŃ”).
// Obie strony normalizujemy do NFC — „Ń” może przyjść jako N + znak łączący (NFD), np. z klawiatury macOS.
export function matchesWord(input: string, word: string): boolean {
  return (
    input.normalize("NFC").trim().toLocaleUpperCase("pl") === word.normalize("NFC").trim().toLocaleUpperCase("pl")
  );
}
