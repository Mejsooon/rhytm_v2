// Ikony stron jak w Notion (IconPicker.dc.html, PageIcon.dc.html). W `pages.icon` zapisujemy:
// emoji → sam znak, ikonę liniową → `lucide:<nazwa>:<kolor>`, brak → '' (domyślna tabela).
// Listy przepisane 1:1 z makiety: [znak albo nazwa, słowa do wyszukiwania].

export const EMOJI = [
  ["📚", "książki books czytanie biblioteka"], ["📖", "książka book czytanie"], ["📝", "notatki notes pisanie"], ["📁", "folder projekty"],
  ["🗂️", "teczka archiwum dokumenty"], ["💼", "praca work biznes"], ["💻", "komputer laptop kod programowanie"], ["🌐", "internet strony www web"],
  ["🚀", "start projekt rakieta launch"], ["🎯", "cel cele target"], ["💡", "pomysł pomysly idea"], ["🧠", "nauka mózg wiedza"],
  ["🎓", "studia szkoła uczelnia nauka"], ["📅", "kalendarz plan data"], ["✅", "zadania todo zrobione"], ["⭐", "ulubione gwiazda star"],
  ["❤️", "serce zdrowie miłość"], ["💪", "siłownia trening siła gym"], ["🏃", "bieganie bieg sport run"], ["🚴", "rower kolarstwo"],
  ["🧘", "joga medytacja spokój"], ["😴", "sen spanie noc"], ["🍎", "jedzenie dieta zdrowie owoc"], ["☕", "kawa coffee"],
  ["🍕", "jedzenie pizza food"], ["🎬", "filmy seriale kino film"], ["🎵", "muzyka music"], ["🎮", "gry gaming"],
  ["📷", "zdjęcia foto aparat"], ["🎨", "sztuka design projektowanie"], ["✈️", "podróże samolot travel"], ["🏠", "dom mieszkanie home"],
  ["🚗", "samochód auto car"], ["🌱", "rośliny ogród rozwój"], ["🔥", "ogień streak passa"], ["⚡", "energia szybko"],
  ["💰", "pieniądze finanse budżet"], ["💳", "subskrypcje płatności karta"], ["🔒", "hasła bezpieczeństwo kłódka"], ["🔑", "klucz hasła"],
  ["🛒", "zakupy sklep"], ["🎁", "prezenty prezent"], ["👥", "ludzie zespół kontakty"], ["👤", "osoba profil"],
  ["📈", "wykres wzrost statystyki"], ["📊", "statystyki dane raport"], ["🔧", "narzędzia naprawa"], ["⚙️", "ustawienia"],
  ["🏆", "osiągnięcia nagroda puchar"], ["🌍", "świat podróże ziemia"], ["☀️", "słońce dzień"], ["🌙", "noc księżyc"],
  ["🐶", "pies zwierzęta"], ["🎉", "impreza święto"], ["📦", "paczka dostawa"], ["🧾", "rachunki faktury"],
] as const satisfies readonly (readonly [string, string])[];

export const ICON_NAMES = [
  ["table", "tabela table"], ["book-open", "książka czytanie book"], ["bookmark", "zakładka bookmark"], ["file-text", "dokument notatki plik"],
  ["folder", "folder projekty"], ["briefcase", "praca biznes"], ["code", "kod programowanie code"], ["globe", "strony www internet świat"],
  ["rocket", "start projekt rakieta"], ["target", "cel cele"], ["lightbulb", "pomysł idea"], ["graduation-cap", "nauka studia szkoła"],
  ["calendar", "kalendarz plan"], ["check-square", "zadania todo"], ["star", "ulubione gwiazda"], ["heart", "zdrowie serce"],
  ["dumbbell", "siłownia trening"], ["activity", "bieganie sport aktywność"], ["moon", "sen noc"], ["sun", "dzień słońce"],
  ["leaf", "natura rośliny"], ["flame", "ogień streak"], ["zap", "energia"], ["coffee", "kawa"],
  ["film", "filmy seriale kino"], ["music", "muzyka"], ["camera", "zdjęcia foto"], ["plane", "podróże samolot"],
  ["home", "dom mieszkanie"], ["car", "samochód auto"], ["wallet", "pieniądze subskrypcje finanse portfel"], ["shopping-cart", "zakupy koszyk"],
  ["lock", "hasła kłódka bezpieczeństwo"], ["key", "klucz hasła"], ["users", "ludzie zespół"], ["smile", "nastrój uśmiech"],
  ["flag", "flaga cel"],
] as const satisfies readonly (readonly [string, string])[];

export const ICON_COLORS = [
  { key: "gray", hex: "#525252", label: "Szary" },
  { key: "blue", hex: "#0070f3", label: "Niebieski" },
  { key: "green", hex: "#15803d", label: "Zielony" },
  { key: "purple", hex: "#7c3aed", label: "Fioletowy" },
  { key: "orange", hex: "#c2410c", label: "Pomarańczowy" },
  { key: "red", hex: "#b91c1c", label: "Czerwony" },
  { key: "teal", hex: "#0e7490", label: "Morski" },
  { key: "yellow", hex: "#a16207", label: "Żółty" },
] as const;

export type IconName = (typeof ICON_NAMES)[number][0];
export type IconColor = (typeof ICON_COLORS)[number]["key"];
export type ParsedPageIcon =
  | { kind: "emoji"; v: string }
  | { kind: "icon"; v: IconName; color: IconColor }
  | null;

// Tekst z bazy → ikona; wszystko spoza formatu (np. stare znaczki „▦ ★”) → null, czyli ikona domyślna
export function parsePageIcon(raw: string): ParsedPageIcon {
  if (EMOJI.some(([e]) => e === raw)) return { kind: "emoji", v: raw };
  const czesci = raw.split(":");
  if (czesci.length !== 3 || czesci[0] !== "lucide") return null;
  const nazwa = ICON_NAMES.find(([n]) => n === czesci[1])?.[0];
  const kolor = ICON_COLORS.find((k) => k.key === czesci[2])?.key;
  if (nazwa === undefined || kolor === undefined) return null;
  return { kind: "icon", v: nazwa, color: kolor };
}

// Ikona → tekst do zapisu w `pages.icon`
export function serializePageIcon(icon: ParsedPageIcon): string {
  if (icon === null) return "";
  if (icon.kind === "emoji") return icon.v;
  return `lucide:${icon.v}:${icon.color}`;
}

// Wyszukiwanie w pickerze: bez wielkości liter i polskich znaków („ksiazki” znajduje „książki”)
export function matchesIconQuery(keywords: string, query: string): boolean {
  const bezZnakow = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ł/g, "l");
  const fraza = bezZnakow(query);
  return fraza === "" || bezZnakow(keywords).includes(fraza);
}
