"use server";

import { revalidatePath } from "next/cache";
import * as webpush from "web-push";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Godzina 'HH:MM' z minutami co 5 (siatka TimePicker: 12 pól minut)
const godzina5 = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5][05]$/, "Nieprawidłowa godzina.");

const ustawieniaSchema = z
  .object({
    habits_enabled: z.boolean(),
    // Start bloku: tylko 5 min przed albo wyłączone (decyzja C4)
    before_block_min: z.literal(5).nullable(),
    renewals_enabled: z.boolean(),
    quiet_enabled: z.boolean(),
    quiet_from: godzina5,
    quiet_to: godzina5,
  })
  .partial()
  .strict()
  // Cicha noc o równych godzinach nic by nie robiła (wysyłka traktuje ją jak wyłączoną) — odrzucamy
  .refine(
    (p) =>
      p.quiet_from === undefined ||
      p.quiet_to === undefined ||
      p.quiet_from !== p.quiet_to,
    "Początek i koniec cichej nocy muszą się różnić.",
  );

// Ustawienia → Powiadomienia: zapis jednego lub kilku pól od razu po przełączeniu (bez „Zapisz”).
// Brak wiersza ustawień → upsert tworzy go z wartościami domyślnymi pozostałych kolumn.
export async function saveNotificationSettings(
  patch: Partial<{
    habits_enabled: boolean;
    before_block_min: 5 | null;
    renewals_enabled: boolean;
    quiet_enabled: boolean;
    quiet_from: string;
    quiet_to: string;
  }>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = ustawieniaSchema.safeParse(patch);
  if (!parsed.success) {
    // Równe godziny cichej nocy → własny komunikat, reszta → ogólny
    const rowne = parsed.error.issues.find((i) => i.code === "custom");
    return { ok: false, message: rowne?.message ?? BLAD_ZAPISU };
  }
  if (Object.keys(parsed.data).length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sesja wygasła. Zaloguj się ponownie." };

  const { error } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id, ...parsed.data }, { onConflict: "user_id" });
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/ustawienia/powiadomienia");
  return { ok: true };
}

const przypomnienieSchema = z.object({
  habitId: z.uuid(),
  remindAt: godzina5.nullable(),
});

// Ustawienia → Powiadomienia → „Przypomnienia nawyków”: godzina przypomnienia albo null (wyłączone).
// RLS pilnuje, że nawyk należy do użytkownika.
export async function setHabitReminder(
  habitId: string,
  remindAt: string | null,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = przypomnienieSchema.safeParse({ habitId, remindAt });
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("habits")
    .update({ remind_at: parsed.data.remindAt })
    .eq("id", parsed.data.habitId)
    .select("id");
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!data || data.length === 0)
    return { ok: false, message: "Nie znaleziono nawyku." };

  // Godzina przypomnienia jest widoczna w module Nawyki (szczegóły i okno nawyku)
  revalidatePath("/nawyki");
  revalidatePath("/nawyki/[id]", "page");
  revalidatePath("/ustawienia/powiadomienia");
  return { ok: true };
}

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

  // Limit: najwyżej jeden test na 30 s. Znacznik ustawiany atomowo przed wysyłką — update przejdzie tylko wtedy,
  // gdy poprzedni test był dawniej (równoległe kliknięcia: drugi update nie znajdzie wiersza). Wyzwalacz w bazie
  // zamienia wartość na now(), więc znacznika nie da się cofnąć z klienta. Brak wiersza ustawień → tworzymy
  // go z wartościami domyślnymi (brak wiersza i tak oznacza domyślne).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Sesja wygasła. Zaloguj się ponownie." };
  }
  const { error: bladWiersza } = await supabase
    .from("notification_settings")
    .upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
  const granica = new Date(Date.now() - 30_000).toISOString();
  const { data: limit, error: bladLimitu } = await supabase
    .from("notification_settings")
    .update({ last_test_push_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .or(`last_test_push_at.is.null,last_test_push_at.lt.${granica}`)
    .select("user_id");
  if (bladWiersza || bladLimitu) {
    return {
      ok: false,
      message: "Nie udało się wysłać testowego powiadomienia. Spróbuj ponownie.",
    };
  }
  if (!limit || limit.length === 0) {
    return { ok: false, message: "Spróbuj ponownie za chwilę." };
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
