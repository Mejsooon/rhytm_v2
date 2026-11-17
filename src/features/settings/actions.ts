"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { goalsSchema, profileSchema } from "@/features/profile/schemas";
import { createClient } from "@/lib/supabase/server";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export type SaveResult = { ok: true } | { ok: false; errors: Record<string, string> };

// Pierwszy komunikat zod dla każdego pola
function bledyPol(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
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
  if (!parsed.success) return { ok: false, errors: bledyPol(parsed.error.issues) };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, errors: { form: BLAD_ZAPISU } };

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function saveGoals(input: {
  sleep_goal_min: number | string;
  weekly_km_goal: number | string | null;
  currency: string;
  week_start: string;
}): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = goalsSchema.safeParse({ ...input, weekly_km_goal: input.weekly_km_goal ?? "" });
  if (!parsed.success) return { ok: false, errors: bledyPol(parsed.error.issues) };

  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", user.id);
  if (error) return { ok: false, errors: { form: BLAD_ZAPISU } };

  revalidatePath("/", "layout");
  return { ok: true };
}
