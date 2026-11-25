// Po tylu ms od skopiowania sekretu czyścimy schowek (i chowamy znacznik „Skopiowano”).
// Osobny plik bez zależności, żeby tabela, lista haseł i arkusz wiersza brały czas z jednego miejsca
// (mocki page-table w testach nie podmieniają stałej).
export const SCHOWEK_MS = 30_000;
