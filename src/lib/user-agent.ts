// Opis przeglądarki i systemu z nagłówka user-agent: „Chrome · Linux”.
// Wspólny dla wiersza Sesja w Ogólnych, listy sesji i listy urządzeń push.
export function describeUserAgent(ua: string | null): {
  label: string;
  mobile: boolean;
} {
  const tekst = ua ?? "";

  // Kolejność ma znaczenie: Edge i Opera podają też „Chrome/”, Chrome podaje też „Safari/”
  let przegladarka = "Przeglądarka";
  if (tekst.includes("Edg/")) przegladarka = "Edge";
  else if (tekst.includes("OPR/")) przegladarka = "Opera";
  else if (tekst.includes("Firefox/") || tekst.includes("FxiOS"))
    przegladarka = "Firefox";
  else if (tekst.includes("CriOS") || tekst.includes("Chrome/"))
    przegladarka = "Chrome";
  else if (tekst.includes("Safari/")) przegladarka = "Safari";

  // Android podaje też „Linux”, iPhone i iPad „Mac OS X” — telefony sprawdzamy przed komputerami
  let system = "nieznany system";
  if (tekst.includes("iPhone")) system = "iPhone";
  else if (tekst.includes("iPad")) system = "iPad";
  else if (tekst.includes("Android")) system = "Android";
  else if (tekst.includes("Windows")) system = "Windows";
  else if (tekst.includes("Macintosh")) system = "macOS";
  else if (tekst.includes("CrOS")) system = "ChromeOS";
  else if (tekst.includes("Linux")) system = "Linux";

  return {
    label: `${przegladarka} · ${system}`,
    mobile: system === "iPhone" || system === "iPad" || system === "Android",
  };
}
