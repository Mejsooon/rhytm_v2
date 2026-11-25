// Wspólny komunikat błędu zapisu w funkcji stron (toasty i akcje serwera)
export const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Zapis Sekretu odrzucony, bo sejf ma już inną generację (zmiana w innej karcie)
export const SEJF_ZMIENIL_SIE = "Sejf zmienił się w innej karcie. Odblokuj go ponownie.";
// Zapis Sekretu bez odblokowanego sejfu (nie ma czym zaszyfrować)
export const SEJF_ZABLOKOWANY = "Nie zapisano. Sejf musi być odblokowany.";
// Zapis Sekretu odrzucony, bo szyfrogram przekracza 8192 znaki (limit także w bazie)
export const SEKRET_ZA_DLUGI = "Nie zapisano. Tekst jest za długi.";
// „Zapisz” wiersza w trakcie zapisu poprzedniej zmiany (drugi zapis nie rusza, ale nie znika bez śladu)
export const ZAPIS_W_TOKU = "Poczekaj, zapisuję poprzednią zmianę.";
