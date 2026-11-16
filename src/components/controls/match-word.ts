// Porównanie wpisanego słowa potwierdzającego: bez znaczenia wielkość liter i spacje
// na brzegach, ale polskie znaki muszą się zgadzać („usun” ≠ „USUŃ”).
export function matchesWord(input: string, word: string): boolean {
  return input.trim().toLocaleUpperCase("pl") === word.trim().toLocaleUpperCase("pl");
}
