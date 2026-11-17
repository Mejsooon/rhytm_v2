"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Database, Json } from "@/types/database";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";
import type { IsoDate } from "@/components/controls/calendar-math";
import { loadOccurrence } from "./load-occurrence";
import { planScopeChange, type BlockPatch, type Scope } from "./scope";
import { changeOccurrenceSchema, createBlockSchema } from "./schemas";
import { normalizeSeriesStart } from "./series-start";
import type { Recurrence } from "./occurrences";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// 480 → "08:00:00"
function godzinaZMinut(minuty: number): string {
  const hh = String(Math.floor(minuty / 60)).padStart(2, "0");
  const mm = String(minuty % 60).padStart(2, "0");
  return `${hh}:${mm}:00`;
}

// Tworzy blok (jednorazowy albo serię). Zadania z telefonu trafiają do pierwszego wystąpienia.
export async function createBlock(input: {
  title: string;
  categoryId: string | null;
  date: IsoDate;
  startMin: number;
  durationMin: number;
  recurrence: Recurrence | null;
  note: string;
  remind: boolean;
  tasks?: string[];
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = createBlockSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }
  const dane = parsed.data;

  // Kategoria musi istnieć (RLS ukrywa cudze) i nie może być systemowa
  if (dane.categoryId !== null) {
    const { data: kategoria } = await supabase
      .from("categories")
      .select("id, is_system")
      .eq("id", dane.categoryId)
      .maybeSingle();
    if (!kategoria || kategoria.is_system) {
      return { ok: false, message: "Wybierz inną kategorię." };
    }
  }

  const { data: profil } = await supabase
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  const strefa = safeTimezone(profil?.timezone);

  // Seria nie może zaczynać się w dniu, który do niej nie należy
  const dataStartu = normalizeSeriesStart(dane.date, dane.recurrence);

  const { data: blok, error } = await supabase
    .from("blocks")
    .insert({
      user_id: user.id,
      title: dane.title,
      category_id: dane.categoryId,
      note: dane.note,
      start_local: `${dataStartu}T${godzinaZMinut(dane.startMin)}`,
      duration_min: dane.durationMin,
      timezone: strefa,
      recurrence: dane.recurrence as Json | null,
      remind: dane.remind,
    })
    .select("id")
    .single();
  if (error || !blok) return { ok: false, message: BLAD_ZAPISU };

  if (dane.tasks && dane.tasks.length > 0) {
    const { error: blad } = await supabase.from("tasks").insert(
      dane.tasks.map((tytul, i) => ({
        user_id: user.id,
        title: tytul,
        block_id: blok.id,
        occurrence_date: dataStartu,
        due_date: dataStartu,
        position: i,
      })),
    );
    if (blad) {
      // Nie zostawiamy bloku bez zadań, o które prosił użytkownik
      await supabase.from("blocks").delete().eq("id", blok.id);
      return { ok: false, message: BLAD_ZAPISU };
    }
  }

  revalidatePath("/kalendarz");
  return { ok: true, id: blok.id };
}

// Zmienia albo usuwa wystąpienie bloku w wybranym zakresie. `date` to ORYGINALNA data wystąpienia.
export async function changeOccurrence(input: {
  blockId: string;
  date: IsoDate;
  scope: Scope;
  patch?: BlockPatch;
  delete?: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = changeOccurrenceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU };
  }
  const dane = parsed.data;
  const patch: BlockPatch = dane.patch ?? {};

  const wczytane = await loadOccurrence(supabase, dane.blockId, dane.date);
  if (!wczytane) {
    return { ok: false, message: "Nie znaleziono tego wystąpienia." };
  }
  const { block, occurrence } = wczytane;

  // Nowa kategoria: musi być własna i nie systemowa
  if (patch.categoryId) {
    const { data: kategoria } = await supabase
      .from("categories")
      .select("id, is_system")
      .eq("id", patch.categoryId)
      .maybeSingle();
    if (!kategoria || kategoria.is_system) {
      return { ok: false, message: "Wybierz inną kategorię." };
    }
  }

  const plan = planScopeChange({
    block,
    occurrence,
    scope: dane.scope,
    patch,
    delete: dane.delete,
  });

  if (plan.kind === "upsertException") {
    const { error } = await supabase
      .from("block_exceptions")
      .upsert(plan.row, { onConflict: "block_id,occurrence_date" });
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "deleteBlock") {
    // Zadania odpina wyzwalacz w bazie
    const { error } = await supabase.from("blocks").delete().eq("id", block.id);
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "split") {
    const { error } = await supabase.rpc("split_block_series", {
      p_block_id: block.id,
      p_from: plan.from,
      p_patch: plan.patch as Json,
      p_delete: plan.delete,
    });
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "detachTasksAndCancel") {
    // Zadania tego wystąpienia stają się samodzielne (due_date zostaje), potem odwołujemy wystąpienie
    const { error: blad1 } = await supabase
      .from("tasks")
      .update({ block_id: null, occurrence_date: null })
      .eq("block_id", block.id)
      .eq("occurrence_date", plan.date);
    if (blad1) return { ok: false, message: BLAD_ZAPISU };

    const { error: blad2 } = await supabase.from("block_exceptions").upsert(
      {
        block_id: block.id,
        user_id: block.user_id,
        occurrence_date: plan.date,
        kind: "cancelled",
      },
      { onConflict: "block_id,occurrence_date" },
    );
    if (blad2) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "updateBlock") {
    const p = plan.patch;
    const dataBloku = block.start_local.slice(0, 10);
    const minutyBloku =
      Number(block.start_local.slice(11, 13)) * 60 + Number(block.start_local.slice(14, 16));

    const nowyStart = p.startMin ?? minutyBloku;
    const nowyCzas = p.durationMin ?? block.duration_min;
    if (nowyStart + nowyCzas > 1440) {
      return { ok: false, message: "Blok nie może przechodzić przez północ." };
    }

    const zmiany: Database["public"]["Tables"]["blocks"]["Update"] = { updated_at: new Date().toISOString() };
    if (p.title !== undefined) zmiany.title = p.title;
    if (p.categoryId !== undefined) zmiany.category_id = p.categoryId;
    if (p.note !== undefined) zmiany.note = p.note;
    if (p.remind !== undefined) zmiany.remind = p.remind;
    if (p.durationMin !== undefined) zmiany.duration_min = p.durationMin;
    if (p.recurrence !== undefined) zmiany.recurrence = p.recurrence as Json | null;

    // Start zmieniamy, gdy ruszył dzień, godzina albo powtarzalność
    if (p.date !== undefined || p.startMin !== undefined || p.recurrence !== undefined) {
      const nowaData = p.date ?? dataBloku;
      // Nowa powtarzalność też nie może dać "ducha" na starcie serii
      const dataStartu =
        p.recurrence !== undefined ? normalizeSeriesStart(nowaData, p.recurrence) : nowaData;
      zmiany.start_local = `${dataStartu}T${godzinaZMinut(nowyStart)}`;
    }

    const { error } = await supabase.from("blocks").update(zmiany).eq("id", block.id);
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  revalidatePath("/kalendarz");
  return { ok: true };
}
