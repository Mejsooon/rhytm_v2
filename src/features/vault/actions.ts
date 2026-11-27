"use server";

import { redirect } from "next/navigation";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { BLAD_ZAPISU } from "@/features/pages/messages";
import type { VaultMaterial } from "./crypto";
import { updatedAtSchema, vaultMaterialSchema } from "./schemas";
import { DOMYSLNE_USTAWIENIA, vaultSettingsSchema, type VaultSettings } from "./settings";

type Blad = { ok: false; message: string };

const SEJF_ISTNIEJE = "Sejf już istnieje.";
const INNA_KARTA = "Sejf zmienił się w innej karcie. Odblokuj go ponownie.";

// Serwer przechowuje wyłącznie materiał owinięty w przeglądarce; hasła głównego ani klucza danych nie widzi,
// a komunikaty błędów nigdy nie zawierają przesłanego materiału.

// Aktywny sejf użytkownika; null, gdy brak wiersza albo status 'reset'
export async function getVault(): Promise<
  | {
      ok: true;
      settings: VaultSettings;
      vault:
        | (VaultMaterial & { generation: number; created_at: string; updated_at: string })
        | null;
    }
  | Blad
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data, error } = await supabase
    .from("vaults")
    .select("status, generation, kdf, wrapped_key, wrap_iv, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, message: BLAD_ZAPISU };
  // Ustawienia z profilu; błąd odczytu = domyślne (sejf ma działać także wtedy)
  const { data: profil } = await supabase
    .from("profiles")
    .select("vault_lock_min, vault_clear_clipboard, vault_ask_on_reveal")
    .eq("user_id", user.id)
    .maybeSingle();
  const settings: VaultSettings = {
    lockMin: (profil?.vault_lock_min as VaultSettings["lockMin"]) ?? DOMYSLNE_USTAWIENIA.lockMin,
    clearClipboard: profil?.vault_clear_clipboard ?? DOMYSLNE_USTAWIENIA.clearClipboard,
    askOnReveal: profil?.vault_ask_on_reveal ?? DOMYSLNE_USTAWIENIA.askOnReveal,
  };
  if (!data || data.status !== "active") return { ok: true, settings, vault: null };
  return {
    ok: true,
    settings,
    vault: {
      kdf: data.kdf as unknown as VaultMaterial["kdf"],
      wrapped_key: data.wrapped_key,
      wrap_iv: data.wrap_iv,
      generation: data.generation,
      created_at: data.created_at,
      updated_at: data.updated_at,
    },
  };
}

// Pierwszy sejf (INSERT) albo odtworzenie po resecie (UPDATE reset → active; generation podbił już reset_vault)
export async function createVault(
  m: VaultMaterial,
): Promise<{ ok: true; generation: number } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const material = vaultMaterialSchema.safeParse(m);
  if (!material.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: istniejacy, error: bladOdczytu } = await supabase
    .from("vaults")
    .select("status, generation")
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (istniejacy && istniejacy.status === "active") return { ok: false, message: SEJF_ISTNIEJE };

  if (!istniejacy) {
    const { error } = await supabase.from("vaults").insert({
      user_id: user.id,
      status: "active",
      generation: 1,
      kdf: material.data.kdf as Json,
      wrapped_key: material.data.wrapped_key,
      wrap_iv: material.data.wrap_iv,
    });
    // Wyścig dwóch kart: unikalny user_id odrzuci drugi INSERT
    if (error) return { ok: false, message: error.code === "23505" ? SEJF_ISTNIEJE : BLAD_ZAPISU };
    return { ok: true, generation: 1 };
  }

  // Warunek status = 'reset' chroni przed wyścigiem: drugi UPDATE nie trafi w żaden wiersz
  const { data: odtworzony, error } = await supabase
    .from("vaults")
    .update({
      status: "active",
      kdf: material.data.kdf as Json,
      wrapped_key: material.data.wrapped_key,
      wrap_iv: material.data.wrap_iv,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("status", "reset")
    .select("generation")
    .maybeSingle();
  if (error) return { ok: false, message: BLAD_ZAPISU };
  if (!odtworzony) return { ok: false, message: SEJF_ISTNIEJE };
  return { ok: true, generation: odtworzony.generation };
}

// Zmiana hasła głównego: nowy materiał owinięty tym samym kluczem danych. Optymistycznie po updated_at.
export async function rewrapVault(
  m: VaultMaterial,
  expectedUpdatedAt: string,
): Promise<{ ok: true; updated_at: string } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const material = vaultMaterialSchema.safeParse(m);
  const oczekiwany = updatedAtSchema.safeParse(expectedUpdatedAt);
  if (!material.success || !oczekiwany.success) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("vaults")
    .update({
      kdf: material.data.kdf as Json,
      wrapped_key: material.data.wrapped_key,
      wrap_iv: material.data.wrap_iv,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", user.id)
    .eq("status", "active")
    .eq("updated_at", oczekiwany.data)
    .select("updated_at")
    .maybeSingle();
  if (error) return { ok: false, message: BLAD_ZAPISU };
  // Żaden wiersz nie pasuje: sejf zmieniono (inna karta, zmiana hasła) albo został zresetowany
  if (!data) return { ok: false, message: INNA_KARTA };
  return { ok: true, updated_at: data.updated_at };
}

// Reset: funkcja SQL czyści Sekrety (także z kosza), podbija generation i zwraca liczbę wyczyszczonych wartości
export async function resetVault(): Promise<{ ok: true; cleared: number } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data, error } = await supabase.rpc("reset_vault");
  if (error || typeof data !== "number") return { ok: false, message: BLAD_ZAPISU };
  return { ok: true, cleared: data };
}

// Liczba niepustych Sekretów (okno resetu pokazuje, ile zostanie usunięte)
export async function countSecrets(): Promise<{ ok: true; count: number } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data, error } = await supabase.rpc("count_secrets");
  if (error || typeof data !== "number") return { ok: false, message: BLAD_ZAPISU };
  return { ok: true, count: data };
}

export async function saveVaultSettings(patch: Partial<VaultSettings>): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const dane = vaultSettingsSchema.safeParse(patch);
  if (!dane.success || Object.keys(dane.data).length === 0) return { ok: false, message: BLAD_ZAPISU };

  const { lockMin, clearClipboard, askOnReveal } = dane.data;
  // Pola o wartości undefined nie trafiają do zapytania
  const { error } = await supabase
    .from("profiles")
    .update({ vault_lock_min: lockMin, vault_clear_clipboard: clearClipboard, vault_ask_on_reveal: askOnReveal })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}
