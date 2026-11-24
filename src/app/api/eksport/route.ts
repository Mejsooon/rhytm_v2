import type { SupabaseClient } from "@supabase/supabase-js";

import { safeTimezone } from "@/lib/time/timezones";
import { createClient } from "@/lib/supabase/server";

// Eksport danych użytkownika jako JSON (Ustawienia → Konto i bezpieczeństwo → „Eksport danych”).
// Sesja użytkownika i RLS — bez klucza tajnego. Sekrety (wartości pól Sekret, owinięty klucz sejfu)
// są w bazie szyfrogramami i tak trafiają do pliku. Zdjęcie profilowe nie wchodzi do eksportu (decyzja C10).

// Tabele w stałej kolejności: [nazwa, kolumny klucza do sortowania (stabilne strony), wybrane kolumny]
const TABELE: [string, string[], string][] = [
  ["profiles", ["user_id"], "*"],
  ["notification_settings", ["user_id"], "*"],
  ["categories", ["id"], "*"],
  ["blocks", ["id"], "*"],
  ["block_exceptions", ["block_id", "occurrence_date"], "*"],
  ["tasks", ["id"], "*"],
  ["habits", ["id"], "*"],
  ["habit_schedules", ["habit_id", "valid_from"], "*"],
  ["habit_checks", ["habit_id", "date"], "*"],
  ["habit_notes", ["id"], "*"],
  ["sleep_logs", ["user_id", "date"], "*"],
  ["workout_templates", ["id"], "*"],
  ["workout_template_items", ["id"], "*"],
  ["template_skips", ["template_id", "date"], "*"],
  ["sport_sessions", ["id"], "*"],
  ["runs", ["session_id"], "*"],
  ["exercises", ["id"], "*"],
  ["gym_sets", ["id"], "*"],
  ["pages", ["id"], "*"],
  ["page_blocks", ["id"], "*"],
  ["page_fields", ["id"], "*"],
  ["page_rows", ["id"], "*"],
  ["vaults", ["user_id"], "*"],
  // Bez kluczy urządzenia (endpoint, p256dh, auth) — poza przeglądarką są bezużyteczne
  [
    "push_subscriptions",
    ["id"],
    "id, label, enabled, created_at, last_seen_at",
  ],
];

// Strona odczytu = limit max_rows PostgREST (supabase/config.toml)
const STRONA = 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return Response.json(
      { error: "Brak sesji" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );

  // Nazwy tabel z listy (część może jeszcze nie istnieć w typach i w bazie) — klient bez typów
  const db = supabase as unknown as SupabaseClient;
  const tabele: Record<string, unknown[]> = {};
  const pominiete: string[] = [];

  for (const [nazwa, klucze, kolumny] of TABELE) {
    const wiersze: unknown[] = [];
    let blad = false;
    for (let od = 0; ; od += STRONA) {
      let zapytanie = db.from(nazwa).select(kolumny);
      for (const klucz of klucze)
        zapytanie = zapytanie.order(klucz, { ascending: true });
      const { data, error } = await zapytanie.range(od, od + STRONA - 1);
      // Błąd jednej tabeli (np. brak tabeli na starej bazie) nie przerywa eksportu
      if (error) {
        blad = true;
        break;
      }
      wiersze.push(...(data ?? []));
      if (!data || data.length < STRONA) break;
    }
    if (blad) pominiete.push(nazwa);
    else tabele[nazwa] = wiersze;
  }

  // Data w nazwie pliku w strefie z profilu
  const profil = tabele.profiles?.[0] as
    | { timezone?: string | null }
    | undefined;
  const teraz = new Date();
  const data = new Intl.DateTimeFormat("en-CA", {
    timeZone: safeTimezone(profil?.timezone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(teraz);

  const tresc = JSON.stringify(
    {
      format: "rhytm-eksport",
      wersja: 1,
      utworzono: teraz.toISOString(),
      konto: { id: user.id, email: user.email ?? null },
      tabele,
      pominiete,
    },
    null,
    2,
  );

  return new Response(tresc, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="rhytm-export-${data}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
