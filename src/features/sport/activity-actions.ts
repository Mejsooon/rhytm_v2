"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { activityKcal, activityKinds } from "./activities";
import { idSchema, isoDateSchema } from "./schemas";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

const schemat = z
  .object({
    id: idSchema.optional(),
    kind: z.string().trim().min(1, "Wybierz rodzaj aktywności.").max(40, "Nazwa może mieć maksymalnie 40 znaków."),
    color: z.string().regex(/^#[0-9a-f]{6}$/),
    hasDistance: z.boolean(),
    done: z.boolean(),
    date: isoDateSchema,
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Podaj godzinę w formacie GG:MM."),
    durationS: z.number().int().min(60, "Podaj czas trwania.").max(86400, "Czas musi być krótszy niż 24 h.").nullable(),
    distanceKm: z.number().positive("Dystans musi być większy od 0.").max(1000, "Za duży dystans.").nullable(),
    difficulty: z.number().int().min(1).max(10).nullable(),
    note: z
      .string()
      .max(1000, "Notatka może mieć maksymalnie 1000 znaków.")
      .transform((n) => (n.trim() === "" ? null : n)),
    showInCalendar: z.boolean(),
  })
  .refine((a) => !a.done || a.durationS !== null, { message: "Podaj czas trwania.", path: ["durationS"] });

export type ActivityInput = z.input<typeof schemat>;

// Zapis innej aktywności: sesja typu 'other' + wiersz activities; własny rodzaj albo zmieniony kolor
// trafia do activity_kinds.
export async function saveActivity(input: ActivityInput): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = schemat.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  const a = parsed.data;

  const [profil, rodzajeRes] = await Promise.all([
    supabase.from("profiles").select("weight_kg").eq("user_id", user.id).maybeSingle(),
    supabase.from("activity_kinds").select("id, name, color, has_distance").eq("user_id", user.id),
  ]);
  if (profil.error || rodzajeRes.error) return { ok: false, message: BLAD_ZAPISU };

  const wlasne = rodzajeRes.data ?? [];
  const znany = activityKinds(wlasne).find((k) => k.name.toLowerCase() === a.kind.toLowerCase());
  // Nazwa jak w istniejącym rodzaju (bez rozróżniania wielkości liter)
  const nazwa = znany?.name ?? a.kind;
  if (!znany || znany.color !== a.color) {
    const wiersz = wlasne.find((k) => k.name.toLowerCase() === nazwa.toLowerCase());
    const { error } = wiersz
      ? await supabase.from("activity_kinds").update({ color: a.color }).eq("id", wiersz.id)
      : await supabase
          .from("activity_kinds")
          .insert({ user_id: user.id, name: nazwa, color: a.color, has_distance: a.hasDistance });
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  const sesja = {
    title: nazwa,
    start_local: `${a.date}T${a.start}:00`,
    note: a.note,
    completed: a.done,
    show_in_calendar: a.showInCalendar,
  };
  let sessionId = a.id;
  if (sessionId) {
    const { data, error } = await supabase
      .from("sport_sessions")
      .update(sesja)
      .eq("id", sessionId)
      .eq("user_id", user.id)
      .eq("type", "other")
      .select("id");
    if (error || !data?.length) return { ok: false, message: BLAD_ZAPISU };
  } else {
    const { data, error } = await supabase
      .from("sport_sessions")
      .insert({ ...sesja, user_id: user.id, type: "other" })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: BLAD_ZAPISU };
    sessionId = data.id;
  }

  const { error } = await supabase.from("activities").upsert(
    {
      session_id: sessionId,
      user_id: user.id,
      kind: nazwa,
      distance_km: (znany?.hasDistance ?? a.hasDistance) ? a.distanceKm : null,
      duration_s: a.durationS,
      difficulty: a.difficulty,
      kcal: a.done ? activityKcal(znany?.met ?? 5, a.durationS, profil.data?.weight_kg ?? null) : null,
    },
    { onConflict: "session_id" },
  );
  if (error) {
    // Nowa sesja bez danych aktywności nie zostaje
    if (!a.id) await supabase.from("sport_sessions").delete().eq("id", sessionId);
    return { ok: false, message: BLAD_ZAPISU };
  }

  revalidatePath("/sport");
  revalidatePath("/kalendarz");
  revalidatePath("/dzis");
  return { ok: true };
}
