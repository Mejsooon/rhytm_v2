"use server";

import { revalidatePath } from "next/cache";
import * as webpush from "web-push";

import { createClient } from "@/lib/supabase/server";

// Ustawienia → Powiadomienia: „Wyślij testowe” — powiadomienie na wszystkie włączone urządzenia użytkownika.
// Cicha noc nie dotyczy testu (decyzja C12). Bez kluczy VAPID (push nieskonfigurowany) → łagodny komunikat.
export async function sendTestPush(): Promise<
  { ok: true; sent: number } | { ok: false; message: string }
> {
  const vapidSubject = process.env.VAPID_SUBJECT;
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
    return { ok: false, message: "Push nie jest jeszcze skonfigurowany." };
  }

  // Własne włączone urządzenia (RLS); stara baza bez tabeli → komunikat
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("enabled", true);
  if (error) {
    return {
      ok: false,
      message: "Nie udało się wysłać testowego powiadomienia. Spróbuj ponownie.",
    };
  }
  const urzadzenia = data ?? [];
  if (urzadzenia.length === 0) {
    return {
      ok: false,
      message: "Włącz push i co najmniej jedno urządzenie, żeby wysłać test.",
    };
  }

  webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
  const payload = JSON.stringify({
    title: "rhytm",
    body: "Powiadomienia działają ✓",
    tag: "test",
    url: "/ustawienia/powiadomienia",
  });
  const wyniki = await Promise.allSettled(
    urzadzenia.map((u) =>
      webpush.sendNotification(
        { endpoint: u.endpoint, keys: { p256dh: u.p256dh, auth: u.auth } },
        payload,
        { TTL: 3600, timeout: 10000 },
      ),
    ),
  );

  let sent = 0;
  const wygasle: string[] = [];
  wyniki.forEach((wynik, i) => {
    if (wynik.status === "fulfilled") {
      sent += 1;
      return;
    }
    // 404/410 = subskrypcja wygasła albo została cofnięta w przeglądarce → usuwamy własny wiersz
    const statusCode = (wynik.reason as { statusCode?: number })?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      wygasle.push(urzadzenia[i].endpoint);
    }
  });

  if (wygasle.length > 0) {
    // Błąd usuwania nie zmienia wyniku testu (urządzenie zniknie przy następnej wysyłce crona)
    await supabase.from("push_subscriptions").delete().in("endpoint", wygasle);
    revalidatePath("/ustawienia/powiadomienia");
  }

  if (sent === 0) {
    return {
      ok: false,
      message:
        wygasle.length === urzadzenia.length
          ? "Urządzenia przestały przyjmować powiadomienia. Włącz push ponownie na tym urządzeniu."
          : "Nie udało się wysłać testowego powiadomienia. Spróbuj ponownie.",
    };
  }
  return { ok: true, sent };
}
