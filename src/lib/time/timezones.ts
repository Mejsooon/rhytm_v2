// Strefy czasowe: etykiety przesunięcia, lista wyboru, bezpieczna strefa, format godziny.

const DOMYSLNA_STREFA = "Europe/Warsaw";

// 6 stref z Rozstrzygnięć, w kolejności z ekranu Settings
const STREFY: { value: string; city: string }[] = [
  { value: "Europe/Warsaw", city: "Warszawa" },
  { value: "Europe/Berlin", city: "Berlin" },
  { value: "Europe/London", city: "Londyn" },
  { value: "Europe/Kyiv", city: "Kijów" },
  { value: "America/New_York", city: "Nowy Jork" },
  { value: "Asia/Tokyo", city: "Tokio" },
];

// Czy przeglądarka/Node zna taką strefę
function czyPoprawna(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// "UTC+01:00" / "UTC−05:00" (minus to U+2212, jak w makiecie)
export function utcOffsetLabel(tz: string, at: Date): string {
  const czesci = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    timeZoneName: "longOffset",
  }).formatToParts(at);
  const nazwa = czesci.find((c) => c.type === "timeZoneName")?.value ?? "GMT";
  // "GMT+01:00" -> "UTC+01:00"; samo "GMT" -> "UTC+00:00"
  const przesuniecie = nazwa.replace("GMT", "") || "+00:00";
  return "UTC" + przesuniecie.replace("-", "−");
}

export function timezoneOptions(
  at: Date,
  detected?: string,
): { value: string; city: string; offset: string }[] {
  const lista = [...STREFY];
  if (
    detected &&
    czyPoprawna(detected) &&
    !lista.some((s) => s.value === detected)
  ) {
    const miasto = detected.split("/").pop()!.replace(/_/g, " ");
    lista.push({ value: detected, city: miasto });
  }
  return lista.map((s) => ({ ...s, offset: utcOffsetLabel(s.value, at) }));
}

export function safeTimezone(tz: string | undefined | null): string {
  return tz && czyPoprawna(tz) ? tz : DOMYSLNA_STREFA;
}

// "08:00" (24h) albo "8:00 AM" (12h); 24:00 (koniec doby) to "24:00" albo "12:00 AM"
export function formatClockTime(
  h: number,
  m: number,
  clock: "24" | "12",
): string {
  const minuty = String(m).padStart(2, "0");
  if (clock === "12") {
    // Północ na końcu doby (24:00) to 12:00 AM, nie południe
    if (h === 24) return `12:${minuty} AM`;
    return `${h % 12 || 12}:${minuty} ${h < 12 ? "AM" : "PM"}`;
  }
  return `${String(h).padStart(2, "0")}:${minuty}`;
}
