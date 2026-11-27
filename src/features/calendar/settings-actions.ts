"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { WIDOK_W_BAZIE, type CalendarSettings } from "./settings";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

const schemat = z
  .object({
    view: z.enum(["dzien", "tydzien", "miesiac"]),
    fromHour: z.number().int().min(0).max(20),
    toHour: z.number().int().min(4).max(24),
    blockMin: z.union([z.literal(30), z.literal(60), z.literal(90)]),
    weekNumbers: z.boolean(),
    showSport: z.boolean(),
    showRenewals: z.boolean(),
  })
  .partial();

// Zapisuje tylko podane pola; zakres godzin pilnuje też ograniczenie w bazie
export async function saveCalendarSettings(patch: Partial<CalendarSettings>): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = schemat.safeParse(patch);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };
  const p = parsed.data;

  const { error } = await supabase
    .from("profiles")
    .update({
      ...(p.view !== undefined && { calendar_view: WIDOK_W_BAZIE[p.view] }),
      ...(p.fromHour !== undefined && { calendar_from_hour: p.fromHour }),
      ...(p.toHour !== undefined && { calendar_to_hour: p.toHour }),
      ...(p.blockMin !== undefined && { calendar_block_min: p.blockMin }),
      ...(p.weekNumbers !== undefined && { calendar_week_numbers: p.weekNumbers }),
      ...(p.showSport !== undefined && { calendar_show_sport: p.showSport }),
      ...(p.showRenewals !== undefined && { calendar_show_renewals: p.showRenewals }),
    })
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true };
}
