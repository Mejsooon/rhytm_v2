"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { describeUserAgent } from "@/lib/user-agent";

// Urządzenia push (Ustawienia → Powiadomienia). Zapis tylko przez funkcję bazy save_push_subscription,
// która sprawdza listę dozwolonych serwerów push; odczyt, wyłączenie i usunięcie przez RLS.
// Stara baza (bez tabeli i funkcji) → komunikaty błędów, nic się nie psuje.

// Te same limity co w bazie (push_subscriptions_lengths)
const napis = z.string().min(1).max(1000);

const urzadzenieSchema = z.object({
  endpoint: napis,
  p256dh: napis,
  auth: napis,
});

export async function savePushDevice(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
}): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const parsed = urzadzenieSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Nie udało się zapisać urządzenia." };

  // Etykieta liczona na serwerze z nagłówka żądania: „Chrome · Windows”
  const ua = (await headers()).get("user-agent");
  const { label } = describeUserAgent(ua);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.p256dh,
    p_auth: parsed.data.auth,
    p_label: label,
  });
  if (error || typeof data !== "string")
    return { ok: false, message: "Nie udało się zapisać urządzenia." };

  // Lista urządzeń na zakładce Powiadomienia jest renderowana na serwerze
  revalidatePath("/ustawienia/powiadomienia");
  return { ok: true, id: data };
}

// Usuwa urządzenie o danym endpoincie (RLS: tylko własne)
export async function removePushDevice(
  endpoint: string,
): Promise<{ ok: boolean }> {
  const parsed = napis.safeParse(endpoint);
  if (!parsed.success) return { ok: false };

  const supabase = await createClient();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", parsed.data);
  if (error) return { ok: false };

  revalidatePath("/ustawienia/powiadomienia");
  return { ok: true };
}

const wlaczenieSchema = z.object({ id: z.uuid(), enabled: z.boolean() });

// Włącza albo wyłącza powiadomienia na jednym z urządzeń (zmienia tylko kolumnę enabled)
export async function setDeviceEnabled(
  id: string,
  enabled: boolean,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const parsed = wlaczenieSchema.safeParse({ id, enabled });
  if (!parsed.success)
    return { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .update({ enabled: parsed.data.enabled })
    .eq("id", parsed.data.id)
    .select("id");
  if (error)
    return { ok: false, message: "Nie udało się zapisać. Spróbuj ponownie." };
  // Brak wiersza = urządzenie usunięte w międzyczasie (albo cudze — RLS)
  if (!data || data.length === 0)
    return { ok: false, message: "To urządzenie zostało już usunięte." };

  revalidatePath("/ustawienia/powiadomienia");
  return { ok: true };
}
