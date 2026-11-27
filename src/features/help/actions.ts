"use server";

import { redirect } from "next/navigation";
import { z } from "zod";

import { loadToday } from "@/features/today/load-today";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";

const schemat = z.object({
  kind: z.enum(["idea", "bug", "other"]),
  message: z.string().trim().min(1).max(4000),
  contact: z.boolean(),
  // Dołączane tylko do błędu: ekran, przeglądarka, wersja, kod
  context: z
    .object({
      screen: z.string().max(200),
      browser: z.string().max(100),
      version: z.string().max(20),
      code: z.string().max(100),
    })
    .partial()
    .strict(),
});

export type FeedbackInput = z.infer<typeof schemat>;

export async function sendFeedback(input: FeedbackInput): Promise<ActionResult> {
  const parsed = schemat.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Nie udało się wysłać. Skróć treść i spróbuj ponownie." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Bez .select(): zalogowany nie ma prawa odczytu zgłoszeń. user_id wstawia baza z sesji.
  const { error } = await supabase.from("feedback").insert(parsed.data);
  return error ? { ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." } : { ok: true };
}

// „Pierwsze kroki n / 6” w menu pomocy. Liczone dopiero po otwarciu menu.
// shortcut: wczytuje całe dane Dziś; osobne zapytanie, jeśli menu zacznie się dłużyć.
export async function firstStepsCount(): Promise<number | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const dane = await loadToday(supabase, user.id).catch(() => null);
  return dane ? Object.values(dane.firstSteps.done).filter(Boolean).length : null;
}
