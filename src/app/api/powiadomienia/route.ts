// Lista centrum powiadomień. Zwykły GET, nie Server Action: akcje Next idą po kolei, więc odczyt
// przy wejściu wstrzymywałby zapisy użytkownika. Wpisy dodaje zadanie crona w bazie.
import type { Inbox, InboxItem } from "@/features/notifications/inbox";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";

const DNI_30 = 30 * 24 * 60 * 60 * 1000;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const [wpisy, profil] = await Promise.all([
    supabase
      .from("notifications")
      .select("id, kind, title, body, url, created_at, read_at")
      .eq("user_id", user.id)
      // Cron sprząta starsze wpisy; filtr na wypadek, gdyby akurat nie chodził
      .gte("created_at", new Date(Date.now() - DNI_30).toISOString())
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
  ]);
  if (wpisy.error) return Response.json({ error: "read failed" }, { status: 500 });

  const inbox: Inbox = {
    timeZone: safeTimezone(profil.data?.timezone),
    items: (wpisy.data ?? []).map((w) => ({
      id: w.id,
      kind: w.kind as InboxItem["kind"],
      title: w.title,
      body: w.body,
      url: w.url,
      createdAt: w.created_at,
      read: w.read_at !== null,
    })),
  };
  return Response.json(inbox, { headers: { "Cache-Control": "no-store" } });
}
