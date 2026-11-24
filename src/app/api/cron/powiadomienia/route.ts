import { timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";
import { z } from "zod";

// Bez `export const runtime`: przy cacheComponents Next używa domyślnie Node.js
// i odrzuca ten eksport w route handlerze.

// Wiersze z claim_due_notifications (jeden na parę przypomnienie–urządzenie)
const bodySchema = z.object({
  notifications: z.array(
    z.object({
      endpoint: z.string(),
      p256dh: z.string(),
      auth: z.string(),
      kind: z.string(),
      title: z.string(),
      body: z.string(),
      tag: z.string(),
      url: z.string(),
    }),
  ),
});

// Wywoływana przez pg_cron/pg_net (dispatch_notifications w Supabase): body { notifications: [...] },
// nagłówek Authorization: Bearer <CRON_SECRET>. Odpowiedź { sent, failed, removed }.
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  // Wymagamy dokładnie "Bearer <sekret>"; porównanie w stałym czasie (długość nie jest tajemnicą)
  const header = request.headers.get("authorization") ?? "";
  const tokenBytes = Buffer.from(header);
  const secretBytes = Buffer.from(`Bearer ${cronSecret ?? ""}`);
  if (
    !cronSecret ||
    tokenBytes.length !== secretBytes.length ||
    !timingSafeEqual(tokenBytes, secretBytes)
  ) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  const notifications = parsed.data.notifications;

  // Brak kluczy VAPID zdradzamy dopiero po poprawnym tokenie
  const vapidSubject = process.env.VAPID_SUBJECT;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    console.error(
      "Brak konfiguracji VAPID (VAPID_SUBJECT, NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)",
    );
    return Response.json({ error: "vapid not configured" }, { status: 500 });
  }
  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

  const results = await Promise.allSettled(
    notifications.map((n) =>
      webpush.sendNotification(
        { endpoint: n.endpoint, keys: { p256dh: n.p256dh, auth: n.auth } },
        JSON.stringify({ title: n.title, body: n.body, tag: n.tag, url: n.url }),
        // timeout: zawieszony serwer push nie może zatrzymać całej wysyłki
        { TTL: 3600, timeout: 10000 },
      ),
    ),
  );

  let sent = 0;
  let failed = 0;
  const expiredEndpoints: string[] = [];
  results.forEach((result, index) => {
    if (result.status === "fulfilled") {
      sent += 1;
      return;
    }
    failed += 1;
    const endpoint = notifications[index].endpoint;
    const statusCode = (result.reason as { statusCode?: number })?.statusCode;
    // W logach tylko status i origin serwera push — bez kluczy, ścieżki endpointu i treści
    let origin = "unknown";
    try {
      origin = new URL(endpoint).origin;
    } catch {}
    console.error(`Web Push nie powiódł się: status ${statusCode}, ${origin}`);
    // 404/410 = subskrypcja wygasła albo została cofnięta w przeglądarce
    if (
      (statusCode === 404 || statusCode === 410) &&
      !expiredEndpoints.includes(endpoint)
    ) {
      expiredEndpoints.push(endpoint);
    }
  });

  let removed = 0;
  if (expiredEndpoints.length > 0) {
    // Klucz publiczny bez sesji (rola anon): remove_push_subscriptions sama sprawdza sekret z Vault
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data, error } = await supabase.rpc("remove_push_subscriptions", {
      p_secret: cronSecret,
      p_endpoints: expiredEndpoints,
    });
    if (error) {
      console.error(`Usuwanie wygasłych subskrypcji nie powiodło się: ${error.code ?? "błąd"}`);
    } else {
      removed = typeof data === "number" ? data : 0;
    }
  }

  return Response.json({ sent, failed, removed });
}
