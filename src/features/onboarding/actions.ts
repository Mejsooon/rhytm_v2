"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { onboardingStepSchemas } from "@/features/profile/schemas";
import { createClient } from "@/lib/supabase/server";
import { categoriesForRoles, type RoleKey } from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Numer kroku przychodzi z klienta, więc sprawdzamy go przed jakimkolwiek zapisem
const krokSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export type StepResult = { ok: true } | { ok: false; message: string };

// Zapisuje jeden krok kreatora (kroki 1–6) i podnosi postęp onboarding_step (nigdy go nie cofa).
export async function saveOnboardingStep(
  krok: 1 | 2 | 3 | 4 | 5 | 6,
  payload: unknown,
): Promise<StepResult> {
  const krokParsed = krokSchema.safeParse(krok);
  if (!krokParsed.success) {
    return { ok: false, message: BLAD_ZAPISU };
  }
  const step = krokParsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/logowanie");
  }

  const schema = onboardingStepSchemas[step];
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Sprawdź dane i spróbuj ponownie.",
    };
  }

  let zapis: { error: unknown };
  if (step === 1) {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[1]["parse"]
    >;
    // Avatar to dokładnie plik {user_id}/avatar.{ext} (bez podfolderów i "..")
    if (
      d.avatar_path !== null &&
      !new RegExp(`^${user.id}/avatar\\.(png|jpg|jpeg|webp)$`).test(
        d.avatar_path,
      )
    ) {
      return { ok: false, message: "Nieprawidłowe zdjęcie profilowe." };
    }
    zapis = await supabase
      .from("profiles")
      .update({
        display_name: d.display_name,
        timezone: d.timezone,
        week_start: d.week_start,
        clock: d.clock,
        avatar_path: d.avatar_path,
      })
      .eq("user_id", user.id);
  } else if (step === 2) {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[2]["parse"]
    >;
    zapis = await supabase
      .from("profiles")
      .update({ roles: d.roles, study_field: d.study_field })
      .eq("user_id", user.id);
  } else if (step === 3) {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[3]["parse"]
    >;
    zapis = await supabase
      .from("profiles")
      .update({
        workouts_goal_on: d.workouts_goal_on,
        km_goal_on: d.km_goal_on,
        weekly_workouts_goal: d.weekly_workouts_goal,
        weekly_km_goal: d.weekly_km_goal,
        sleep_goal_min: d.sleep_goal_min,
      })
      .eq("user_id", user.id);
  } else if (step === 4) {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[4]["parse"]
    >;
    zapis = await supabase
      .from("profiles")
      .update({
        referral_source: d.referral_source,
        referral_other: d.referral_other,
      })
      .eq("user_id", user.id);
  } else if (step === 5) {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[5]["parse"]
    >;
    zapis = await supabase
      .from("profiles")
      .update({ pending_pages: d.pending_pages })
      .eq("user_id", user.id);
  } else {
    const d = parsed.data as ReturnType<
      (typeof onboardingStepSchemas)[6]["parse"]
    >;
    zapis = await supabase.from("notification_settings").upsert(
      {
        user_id: user.id,
        push_enabled: d.push_enabled,
        before_block_min: d.before ? 5 : null,
        renewals_enabled: d.renew,
        weekly_summary: d.weekly,
        habits_enabled: d.habits,
      },
      { onConflict: "user_id" },
    );
  }
  if (zapis.error) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  // Postęp: onboarding_step = step + 1, tylko gdy obecny jest mniejszy (bez cofania)
  const nastepny = step + 1;
  const { error: bladPostepu } = await supabase
    .from("profiles")
    .update({ onboarding_step: nastepny })
    .eq("user_id", user.id)
    .lt("onboarding_step", nastepny);
  if (bladPostepu) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  return { ok: true };
}

// Kończy onboarding: tworzy kategorie z ról i ustawia onboarded_at (RPC), potem przenosi do aplikacji.
// redirect rzuca wyjątek, więc stoi poza try/catch; błąd zostaje na ekranie.
export async function completeOnboarding(): Promise<{
  ok: false;
  message: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/logowanie");
  }

  const { data: profil, error: bladOdczytu } = await supabase
    .from("profiles")
    .select("roles")
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu || !profil) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  const roles = (profil.roles ?? []) as RoleKey[];
  const { error } = await supabase.rpc("complete_onboarding", {
    p_categories: categoriesForRoles(roles),
  });
  if (error) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  redirect("/dzis");
}
