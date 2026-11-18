"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { goalsSchema, profileSchema } from "@/features/profile/schemas";
import { createClient } from "@/lib/supabase/server";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export type SaveResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string> };

// Pierwszy komunikat zod dla każdego pola
function bledyPol(
  issues: { path: PropertyKey[]; message: string }[],
): Record<string, string> {
  const bledy: Record<string, string> = {};
  for (const issue of issues) {
    const pole = String(issue.path[0] ?? "form");
    if (!(pole in bledy)) bledy[pole] = issue.message;
  }
  return bledy;
}

export async function saveProfile(input: {
  display_name: string;
  timezone: string;
  weight_kg: number | string | null;
  height_cm: number | string | null;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // null (puste pole) → pusty tekst, który schemat zamienia z powrotem na null
  const parsed = profileSchema.safeParse({
    ...input,
    weight_kg: input.weight_kg ?? "",
    height_cm: input.height_cm ?? "",
  });
  if (!parsed.success)
    return { ok: false, errors: bledyPol(parsed.error.issues) };

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, errors: { form: BLAD_ZAPISU } };

  revalidatePath("/", "layout");
  return { ok: true };
}

// Cele treningowe: zapisujemy oba przełączniki i obie liczby (wyłączony cel zachowuje liczbę)
export async function saveGoals(input: {
  sleep_goal_min: number | string;
  workouts_goal_on: boolean;
  km_goal_on: boolean;
  weekly_workouts_goal: number | string | null;
  weekly_km_goal: number | string | null;
  currency: string;
  week_start: string;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = goalsSchema.safeParse({
    ...input,
    weekly_workouts_goal: input.weekly_workouts_goal ?? "",
    weekly_km_goal: input.weekly_km_goal ?? "",
  });
  if (!parsed.success)
    return { ok: false, errors: bledyPol(parsed.error.issues) };

  const { error } = await supabase
    .from("profiles")
    .update(parsed.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, errors: { form: BLAD_ZAPISU } };

  revalidatePath("/", "layout");
  return { ok: true };
}

export type AvatarResult = { ok: true } | { ok: false; error: string };

// Zapisuje ścieżkę zdjęcia wgranego już przez przeglądarkę do bucketu `avatars`
export async function saveAvatar(path: string): Promise<AvatarResult> {
  const blad: AvatarResult = {
    ok: false,
    error: "Nie udało się wgrać zdjęcia.",
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Tylko własny plik `<uid>/avatar.<ext>` (user.id to UUID, więc bez znaków specjalnych w regexie)
  if (
    typeof path !== "string" ||
    !new RegExp(`^${user.id}/avatar\\.(png|jpg|jpeg|webp)$`).test(path)
  ) {
    return blad;
  }

  // Poprzednia ścieżka — do posprzątania, gdy zmieniło się rozszerzenie (np. png → jpg)
  const { data: stary } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: path })
    .eq("user_id", user.id);
  if (error) return blad;

  // Błąd sprzątania pomijamy — nowe zdjęcie jest już zapisane
  if (stary?.avatar_path && stary.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([stary.avatar_path]);
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

// Usuwa plik zdjęcia z bucketu i czyści avatar_path (wracają inicjały)
export async function removeAvatar(): Promise<AvatarResult> {
  const blad: AvatarResult = {
    ok: false,
    error: "Nie udało się usunąć zdjęcia.",
  };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data: profil } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("user_id", user.id)
    .maybeSingle();

  if (profil?.avatar_path) {
    const { error: bladPliku } = await supabase.storage
      .from("avatars")
      .remove([profil.avatar_path]);
    if (bladPliku) return blad;
  }

  const { error } = await supabase
    .from("profiles")
    .update({ avatar_path: null })
    .eq("user_id", user.id);
  if (error) return blad;

  revalidatePath("/", "layout");
  return { ok: true };
}
