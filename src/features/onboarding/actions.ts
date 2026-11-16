"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type OnboardingState = { status: "idle" | "error"; message?: string };

// Oznacza onboarding jako ukończony i przenosi do aplikacji.
// Zapisuje tylko, gdy onboarded_at jest jeszcze puste (nie nadpisujemy pierwszej daty ukończenia).
// Błąd zapisu zostaje na ekranie — przekierowanie na /dzis odbiłoby użytkownika z powrotem na /onboarding.
export async function ukonczOnboarding(): Promise<OnboardingState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/logowanie");
  }

  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .is("onboarded_at", null);
  if (error) {
    return { status: "error", message: "Nie udało się zapisać. Spróbuj ponownie." };
  }

  redirect("/dzis");
}
