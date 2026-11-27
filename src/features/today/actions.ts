"use server";

// Zapis „Pierwszych kroków” w profilu.
import { redirect } from "next/navigation";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { FIRST_STEP_KEYS, type FirstStepKey } from "./first-steps-model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

export async function setFirstStep(key: FirstStepKey, done: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");
  if (!FIRST_STEP_KEYS.includes(key) || typeof done !== "boolean") {
    return { ok: false, message: BLAD_ZAPISU };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("first_steps")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return { ok: false, message: BLAD_ZAPISU };

  const { error: blad } = await supabase
    .from("profiles")
    .update({ first_steps: { ...(data?.first_steps as Record<string, boolean>), [key]: done } })
    .eq("user_id", user.id);
  return blad ? { ok: false, message: BLAD_ZAPISU } : { ok: true };
}

export async function setFirstStepsHidden(hidden: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { error } = await supabase
    .from("profiles")
    .update({ first_steps_hidden: hidden === true })
    .eq("user_id", user.id);
  return error ? { ok: false, message: BLAD_ZAPISU } : { ok: true };
}
