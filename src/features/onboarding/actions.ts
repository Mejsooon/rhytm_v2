"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { todayIso } from "@/components/controls/calendar-math";
import { createBlock } from "@/features/calendar/actions";
import { onboardingStepSchemas } from "@/features/profile/schemas";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";
import { categoriesForUses, pagesForUses, type Step, type UseKey } from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Numer kroku przychodzi z klienta, więc sprawdzamy go przed jakimkolwiek zapisem
const krokSchema = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]);

export type StepResult = { ok: true } | { ok: false; message: string };

type Supabase = Awaited<ReturnType<typeof createClient>>;

async function zalogowany() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");
  return { supabase, user };
}

// Dopisuje brakujące kategorie z wyborów (po nazwie) i zwraca id po nazwie; null = błąd.
// Bloki z kroku 3 potrzebują kategorii przed zakończeniem kreatora.
async function zalozKategorie(supabase: Supabase, userId: string, uses: UseKey[]) {
  const { data: sa, error } = await supabase.from("categories").select("id, name, position").eq("user_id", userId);
  if (error) return null;
  const brakuje = categoriesForUses(uses).filter((k) => !sa.some((s) => s.name === k.name));
  const od = Math.max(-1, ...sa.map((s) => s.position)) + 1;
  let wszystkie: { id: string; name: string }[] = sa;
  if (brakuje.length > 0) {
    const nowe = await supabase
      .from("categories")
      .insert(brakuje.map((k, i) => ({ ...k, user_id: userId, position: od + i })))
      .select("id, name");
    if (nowe.error) return null;
    wszystkie = [...sa, ...nowe.data];
  }
  return new Map(wszystkie.map((k) => [k.name, k.id]));
}

async function czytajProfil(supabase: Supabase, userId: string) {
  const { data } = await supabase.from("profiles").select("roles, timezone").eq("user_id", userId).maybeSingle();
  return data;
}

// Zapisuje jeden krok kreatora i podnosi postęp onboarding_step (nigdy go nie cofa).
// Krok 4 kończy onboarding i przenosi na Dziś.
export async function saveOnboardingStep(krok: Step, payload: unknown): Promise<StepResult> {
  const krokParsed = krokSchema.safeParse(krok);
  if (!krokParsed.success) return { ok: false, message: BLAD_ZAPISU };
  const step = krokParsed.data;

  const { supabase, user } = await zalogowany();

  const parsed = onboardingStepSchemas[step].safeParse(payload);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Sprawdź dane i spróbuj ponownie." };
  }
  const blad = { ok: false as const, message: BLAD_ZAPISU };

  if (step === 1) {
    const d = parsed.data as z.infer<(typeof onboardingStepSchemas)[1]>;
    // Avatar to dokładnie plik {user_id}/avatar.{ext} (bez podfolderów i "..")
    if (d.avatar_path !== null && !new RegExp(`^${user.id}/avatar\\.(png|jpg|jpeg|webp)$`).test(d.avatar_path)) {
      return { ok: false, message: "Nieprawidłowe zdjęcie profilowe." };
    }
    const { error } = await supabase.from("profiles").update(d).eq("user_id", user.id);
    if (error) return blad;
  } else if (step === 2) {
    const d = parsed.data as z.infer<(typeof onboardingStepSchemas)[2]>;
    const uses = d.uses as UseKey[];
    const bieg = uses.includes("run");
    const silownia = uses.includes("gym");
    const { error } = await supabase
      .from("profiles")
      .update({
        roles: uses,
        pending_pages: pagesForUses(uses),
        // Bez biegania i siłowni cele treningowe zostają domyślne (baza wymaga co najmniej jednego)
        ...(bieg || silownia ? { km_goal_on: bieg, workouts_goal_on: silownia } : {}),
        ...(bieg ? { weekly_km_goal: d.weekly_km_goal } : {}),
        ...(silownia ? { weekly_workouts_goal: d.weekly_workouts_goal } : {}),
        ...(uses.includes("sleep") ? { sleep_goal_min: d.sleep_goal_min } : {}),
      })
      .eq("user_id", user.id);
    if (error) return blad;
  } else if (step === 3) {
    const d = parsed.data as z.infer<(typeof onboardingStepSchemas)[3]>;
    if (d.blocks.length > 0) {
      const profil = await czytajProfil(supabase, user.id);
      if (!profil) return blad;
      const kategorie = await zalozKategorie(supabase, user.id, (profil.roles ?? []) as UseKey[]);
      if (!kategorie) return blad;
      const dzis = todayIso(safeTimezone(profil.timezone));
      // Ponowienie po błędzie w połowie listy nie powiela bloków z tym samym tytułem i godziną
      const { data: juz, error: bladOdczytu } = await supabase
        .from("blocks")
        .select("title, start_local")
        .eq("user_id", user.id)
        .gte("start_local", `${dzis}T00:00:00`)
        .lte("start_local", `${dzis}T23:59:59`);
      if (bladOdczytu) return blad;
      const gg = (min: number) =>
        `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
      for (const b of d.blocks) {
        if (juz.some((x) => x.title === b.title && x.start_local.slice(11, 16) === gg(b.start_min))) continue;
        const wynik = await createBlock({
          title: b.title,
          categoryId: kategorie.get(b.category) ?? null,
          date: dzis,
          startMin: b.start_min,
          durationMin: b.end_min - b.start_min,
          recurrence: null,
          note: "",
          remind: true,
        });
        if (!wynik.ok) return wynik;
      }
    }
  } else {
    const d = parsed.data as z.infer<(typeof onboardingStepSchemas)[4]>;
    const { error } = await supabase.from("notification_settings").upsert(
      {
        user_id: user.id,
        push_enabled: d.push_enabled,
        before_block_min: d.before ? 5 : null,
        renewals_enabled: d.renew,
        habits_enabled: d.habits,
      },
      { onConflict: "user_id" },
    );
    if (error) return blad;
    const { error: bladZrodla } = await supabase
      .from("profiles")
      .update({ referral_source: d.referral_source, referral_other: null })
      .eq("user_id", user.id);
    if (bladZrodla) return blad;
  }

  // Postęp: onboarding_step = step + 1, tylko gdy obecny jest mniejszy (bez cofania)
  const nastepny = Math.min(step + 1, 4);
  const { error: bladPostepu } = await supabase
    .from("profiles")
    .update({ onboarding_step: nastepny })
    .eq("user_id", user.id)
    .lt("onboarding_step", nastepny);
  if (bladPostepu) return blad;

  if (step === 4) return completeOnboarding();
  return { ok: true };
}

// Kończy onboarding: kategorie z wyborów i onboarded_at (RPC), potem Dziś.
// redirect rzuca wyjątek, więc stoi poza try/catch; błąd zostaje na ekranie.
async function completeOnboarding(): Promise<StepResult> {
  const { supabase, user } = await zalogowany();
  const profil = await czytajProfil(supabase, user.id);
  if (!profil) return { ok: false, message: BLAD_ZAPISU };

  const uses = (profil.roles ?? []) as UseKey[];
  if (!(await zalozKategorie(supabase, user.id, uses))) return { ok: false, message: BLAD_ZAPISU };
  const { error } = await supabase.rpc("complete_onboarding", { p_categories: categoriesForUses(uses) });
  if (error) return { ok: false, message: BLAD_ZAPISU };

  redirect("/dzis");
}
