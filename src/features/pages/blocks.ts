// Menu „/” edytora (EmptyPage): pozycje, filtrowanie bez wielkości liter i polskich znaków, szybki start.
import type { CreatePageBlock } from "./templates";

export type SlashItem = {
  type: CreatePageBlock["type"];
  icon: string;
  name: string;
  desc: string;
  // Słowa kluczowe z makiety (bez polskich znaków)
  kw: string;
};

export const SLASH_ITEMS: SlashItem[] = [
  { type: "table", icon: "▦", name: "Tabela", desc: "Wiersze i kolumny z typami pól", kw: "tabela table baza database" },
  { type: "todo", icon: "☑", name: "Lista zadań", desc: "Punkty do odhaczenia", kw: "lista zadania todo checkbox" },
  { type: "heading", icon: "H", name: "Nagłówek", desc: "Tytuł sekcji", kw: "naglowek heading tytul sekcja" },
  { type: "text", icon: "¶", name: "Tekst", desc: "Zwykły akapit", kw: "tekst text akapit" },
  { type: "divider", icon: "—", name: "Separator", desc: "Pozioma linia", kw: "separator linia divider hr" },
];

// Małe litery bez znaków diakrytycznych (ł nie rozkłada się w NFD, więc osobno)
function bezOgonkow(s: string): string {
  return s
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export function filterSlash(query: string): SlashItem[] {
  const q = bezOgonkow(query).trim();
  if (q === "") return SLASH_ITEMS;
  return SLASH_ITEMS.filter((i) => bezOgonkow(`${i.name} ${i.desc} ${i.kw}`).includes(q));
}

// Chipy „albo zacznij od:” — pierwsze cztery pozycje menu
export const QUICK_START: { type: CreatePageBlock["type"]; icon: string; label: string }[] =
  SLASH_ITEMS.slice(0, 4).map((i) => ({ type: i.type, icon: i.icon, label: i.name }));
