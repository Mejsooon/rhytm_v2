// Lokalny miernik siły hasła głównego sejfu. Działa tylko w przeglądarce, hasło nigdzie nie wychodzi.

// Minimalna siła, którą akceptuje formularz ustawiania hasła („Średnie”)
export const MASTER_MIN_STRENGTH = 2;

// 0 = „Za krótkie”, 1 = „Słabe”, 2 = „Średnie”, 3 = „Mocne”, 4 = „Bardzo mocne”
export function masterPasswordStrength(pw: string): 0 | 1 | 2 | 3 | 4 {
  // Długość w punktach kodowych (emoji = 1 znak, nie 2 jednostki UTF-16)
  const dlugosc = [...pw].length;

  // Poniżej 12 znaków hasło jest za krótkie
  if (dlugosc < 12) return 0;

  // Bazowy punkt za spełnienie minimalnej długości
  let punkty = 1;
  if (dlugosc >= 16) punkty += 1;
  if (dlugosc >= 20) punkty += 1;

  // Punkt za każdą klasę znaków ponad jedną: małe, wielkie, cyfry, inne
  const klasy = [/[a-ząćęłńóśźż]/, /[A-ZĄĆĘŁŃÓŚŹŻ]/, /[0-9]/, /[^a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ0-9]/].filter((re) =>
    re.test(pw),
  ).length;
  if (klasy > 1) punkty += klasy - 1;

  return Math.min(4, punkty) as 1 | 2 | 3 | 4;
}
