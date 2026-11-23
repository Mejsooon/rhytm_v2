// Ikony stron: w `pages.icon` zapisujemy tylko `lucide:<nazwa>` albo '' (brak → domyślna tabela).
// Nazwa musi należeć do `iconNames` z `lucide-react/dynamic`.

// Polecane ikony (pokazywane w pickerze przy pustym zapytaniu): [nazwa Lucide, polskie słowa do wyszukiwania].
// Nazwy z mapy emoji → Lucide z migracji 20261123100000 plus kilka ikon z dawnej listy ikon.
export const ICON_KEYWORDS: readonly (readonly [string, string])[] = [
  ["book-open", "książki books czytanie biblioteka książka book"],
  ["book", "książka book czytanie"],
  ["notebook-pen", "notatki notes pisanie"],
  ["folder", "folder projekty"],
  ["folder-archive", "teczka archiwum dokumenty"],
  ["briefcase", "praca work biznes"],
  ["laptop", "komputer laptop kod programowanie"],
  ["globe", "internet strony www web świat"],
  ["rocket", "start projekt rakieta launch"],
  ["target", "cel cele target"],
  ["lightbulb", "pomysł pomysly idea"],
  ["brain", "nauka mózg wiedza"],
  ["graduation-cap", "studia szkoła uczelnia nauka"],
  ["calendar", "kalendarz plan data"],
  ["circle-check", "zadania todo zrobione"],
  ["star", "ulubione gwiazda star"],
  ["heart", "serce zdrowie miłość"],
  ["dumbbell", "siłownia trening siła gym"],
  ["footprints", "bieganie bieg sport run"],
  ["bike", "rower kolarstwo"],
  ["flower-2", "joga medytacja spokój"],
  ["bed", "sen spanie noc"],
  ["apple", "jedzenie dieta zdrowie owoc"],
  ["coffee", "kawa coffee"],
  ["pizza", "jedzenie pizza food"],
  ["clapperboard", "filmy seriale kino film"],
  ["music", "muzyka music"],
  ["gamepad-2", "gry gaming"],
  ["camera", "zdjęcia foto aparat"],
  ["palette", "sztuka design projektowanie"],
  ["plane", "podróże samolot travel"],
  ["house", "dom mieszkanie home"],
  ["car", "samochód auto car"],
  ["sprout", "rośliny ogród rozwój"],
  ["flame", "ogień streak passa"],
  ["zap", "energia szybko"],
  ["coins", "pieniądze finanse budżet"],
  ["wallet", "subskrypcje płatności karta portfel"],
  ["lock", "hasła bezpieczeństwo kłódka"],
  ["key", "klucz hasła"],
  ["shopping-cart", "zakupy sklep koszyk"],
  ["gift", "prezenty prezent"],
  ["users", "ludzie zespół kontakty"],
  ["user", "osoba profil"],
  ["trending-up", "wykres wzrost statystyki"],
  ["chart-column", "statystyki dane raport"],
  ["wrench", "narzędzia naprawa"],
  ["settings", "ustawienia"],
  ["trophy", "osiągnięcia nagroda puchar"],
  ["earth", "świat podróże ziemia"],
  ["sun", "słońce dzień"],
  ["moon", "noc księżyc"],
  ["dog", "pies zwierzęta"],
  ["party-popper", "impreza święto"],
  ["package", "paczka dostawa"],
  ["receipt", "rachunki faktury"],
  ["table", "tabela table"],
  ["bookmark", "zakładka bookmark"],
  ["file-text", "dokument notatki plik"],
  ["activity", "aktywność sport"],
  ["smile", "nastrój uśmiech"],
  ["flag", "flaga cel"],
];

// Tekst z bazy → nazwa ikony Lucide; wszystko spoza formatu (stare emoji, kolory, śmieci) → null,
// czyli ikona domyślna. Regex jak w constraincie `pages_icon_format`.
export function parsePageIcon(raw: string): string | null {
  const dopasowanie = /^lucide:([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(raw);
  return dopasowanie === null ? null : dopasowanie[1];
}

// Wyszukiwanie w pickerze: bez wielkości liter i polskich znaków („ksiazki” znajduje „książki”).
// Najpierw trafienia z polskich słów polecanych ikon, potem z nazwy w całym zestawie (bez duplikatów).
// `more` = trafień jest więcej niż `limit`. Puste zapytanie → polecane ikony.
export function searchIcons(
  query: string,
  all: readonly string[],
  limit: number,
): { names: string[]; more: boolean } {
  const fraza = query.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");
  if (fraza === "") {
    const polecane = ICON_KEYWORDS.map(([nazwa]) => nazwa);
    return { names: polecane.slice(0, limit), more: polecane.length > limit };
  }

  const trafione = new Set<string>();
  for (const [nazwa, slowa] of ICON_KEYWORDS) {
    const slowaBezZnakow = slowa.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ł/g, "l");
    if (slowaBezZnakow.includes(fraza)) trafione.add(nazwa);
  }
  for (const nazwa of all) {
    if (nazwa.includes(fraza)) trafione.add(nazwa);
  }
  const wszystkie = [...trafione];
  return { names: wszystkie.slice(0, limit), more: wszystkie.length > limit };
}
