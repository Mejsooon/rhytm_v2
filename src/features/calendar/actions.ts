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
import { expandOccurrences, type Recurrence } from "./occurrences";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const BLAD_UNTIL = "Koniec powtarzania nie może być przed początkiem.";

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
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
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
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
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

  // Wyjątki nie mają ograniczenia w bazie, więc pilnujemy północy tutaj (przed planowaniem).
  // Dla "tylko to" liczy się wystąpienie, dla pozostałych zakresów — sam blok.
  if (dane.delete !== true) {
    const minutyBloku =
      Number(block.start_local.slice(11, 13)) * 60 +
      Number(block.start_local.slice(14, 16));
    const bazowyStart =
      dane.scope === "this" ? occurrence.startMin : minutyBloku;
    const bazowyCzas =
      dane.scope === "this" ? occurrence.durationMin : block.duration_min;
    const wynikowyStart = patch.startMin ?? bazowyStart;
    const wynikowyCzas = patch.durationMin ?? bazowyCzas;
    if (wynikowyStart + wynikowyCzas > 1440) {
      return { ok: false, message: "Blok nie może przechodzić przez północ." };
    }
  }

  const plan = planScopeChange({
    block,
    occurrence,
    scope: dane.scope,
    patch,
    delete: dane.delete,
  });

  if (plan.kind === "reject") {
    return { ok: false, message: plan.message };
  }

  if (plan.kind === "upsertException") {
    const { error } = await supabase
      .from("block_exceptions")
      .upsert(plan.row, { onConflict: "block_id,occurrence_date" });
    if (error) return { ok: false, message: BLAD_ZAPISU };

    // Termin zadań wystąpienia idzie za wystąpieniem: przeniesione na inny dzień — nowy dzień,
    // przeniesione z powrotem — znowu oryginalny. Dzięki temu zadania są w tygodniu, w którym widać blok.
    const nowyDzien = (
      plan.row.new_start_local ?? plan.row.occurrence_date
    ).slice(0, 10);
    const { error: bladZadan } = await supabase
      .from("tasks")
      .update({ due_date: nowyDzien })
      .eq("block_id", plan.row.block_id)
      .eq("occurrence_date", plan.row.occurrence_date);
    if (bladZadan) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "deleteBlock") {
    // Zadania usuwa klucz obcy w bazie (on delete cascade)
    const { data: usuniete, error } = await supabase
      .from("blocks")
      .delete()
      .eq("id", block.id)
      .select("id");
    if (error || !usuniete || usuniete.length === 0)
      return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "split") {
    // Nowe powtarzanie musi obejmować dzień, od którego dzielimy serię
    const noweRec = patch.recurrence;
    if (
      !plan.delete &&
      noweRec?.until !== undefined &&
      noweRec.until < plan.from
    ) {
      return { ok: false, message: BLAD_UNTIL };
    }
    if (
      !plan.delete &&
      noweRec &&
      normalizeSeriesStart(plan.from, noweRec) !== plan.from
    ) {
      return {
        ok: false,
        message: "Nowe powtarzanie musi obejmować ten dzień.",
      };
    }
    const { error } = await supabase.rpc("split_block_series", {
      p_block_id: block.id,
      p_from: plan.from,
      p_patch: plan.patch as Json,
      p_delete: plan.delete,
    });
    if (error) return { ok: false, message: BLAD_ZAPISU };
  }

  if (plan.kind === "deleteTasksAndCancel") {
    // Zadania tego wystąpienia są usuwane, potem odwołujemy wystąpienie
    const { error: blad1 } = await supabase
      .from("tasks")
      .delete()
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
      Number(block.start_local.slice(11, 13)) * 60 +
      Number(block.start_local.slice(14, 16));

    const nowyStart = p.startMin ?? minutyBloku;

    const zmiany: Database["public"]["Tables"]["blocks"]["Update"] = {
      updated_at: new Date().toISOString(),
    };
    if (p.title !== undefined) zmiany.title = p.title;
    if (p.categoryId !== undefined) zmiany.category_id = p.categoryId;
    if (p.note !== undefined) zmiany.note = p.note;
    if (p.remind !== undefined) zmiany.remind = p.remind;
    if (p.durationMin !== undefined) zmiany.duration_min = p.durationMin;
    if (p.recurrence !== undefined)
      zmiany.recurrence = p.recurrence as Json | null;

    // Start zmieniamy, gdy ruszył dzień, godzina albo powtarzalność
    const rec =
      p.recurrence !== undefined
        ? p.recurrence
        : (block.recurrence as Recurrence | null);
    let dataStartu = dataBloku;
    if (
      p.date !== undefined ||
      p.startMin !== undefined ||
      p.recurrence !== undefined
    ) {
      // Seria nie może zaczynać się w dniu, który do niej nie należy („duch” na starcie)
      dataStartu = normalizeSeriesStart(p.date ?? dataBloku, rec);
      zmiany.start_local = `${dataStartu}T${godzinaZMinut(nowyStart)}`;
    }
    if (rec?.until !== undefined && rec.until < dataStartu) {
      return { ok: false, message: BLAD_UNTIL };
    }

    const { data: zmienione, error } = await supabase
      .from("blocks")
      .update(zmiany)
      .eq("id", block.id)
      .select("id");
    if (error || !zmienione || zmienione.length === 0) {
      return { ok: false, message: BLAD_ZAPISU };
    }

    // Zadania z datami, które nie są już wystąpieniami zmienionej serii, są usuwane
    // (zadanie nie istnieje poza blokiem).
    if (zmiany.start_local !== undefined || zmiany.recurrence !== undefined) {
      const { data: zadania } = await supabase
        .from("tasks")
        .select("id, occurrence_date")
        .eq("block_id", block.id);
      const przypiete = zadania ?? [];
      // Blok jednorazowy przesunięty na inny dzień: zadania idą z nim
      const przesunietyJednorazowy =
        block.recurrence === null &&
        zmiany.recurrence === undefined &&
        dataStartu !== dataBloku;
      if (przesunietyJednorazowy) {
        if (przypiete.length > 0) {
          const { error: bladPrzesuniecia } = await supabase
            .from("tasks")
            .update({ occurrence_date: dataStartu, due_date: dataStartu })
            .eq("block_id", block.id);
          if (bladPrzesuniecia) return { ok: false, message: BLAD_ZAPISU };
        }
      } else if (przypiete.length > 0) {
        const daty = przypiete.map((z) => z.occurrence_date).sort();
        const nowyBlok = {
          ...block,
          start_local: zmiany.start_local ?? block.start_local,
          recurrence:
            zmiany.recurrence === undefined
              ? block.recurrence
              : zmiany.recurrence,
        };
        const dniSerii = new Set(
          expandOccurrences([nowyBlok], [], daty[0], daty[daty.length - 1]).map(
            (o) => o.key.slice(-10),
          ),
        );
        const doUsuniecia = przypiete
          .filter((z) => !dniSerii.has(z.occurrence_date))
          .map((z) => z.id);
        if (doUsuniecia.length > 0) {
          const { error: bladUsuniecia } = await supabase
            .from("tasks")
            .delete()
            .in("id", doUsuniecia);
          if (bladUsuniecia) return { ok: false, message: BLAD_ZAPISU };
        }
      }

      // Seria zamieniona w blok jednorazowy: kasujemy WSZYSTKIE wyjątki (jak split w SQL),
      // bo odwołanie z dnia bloku by go ukryło, a zmiana nadpisałaby jego godzinę i tytuł
      const jednorazowy = zmiany.recurrence === null;
      if (jednorazowy) {
        const { error: bladWyjatkow } = await supabase
          .from("block_exceptions")
          .delete()
          .eq("block_id", block.id);
        if (bladWyjatkow) return { ok: false, message: BLAD_ZAPISU };
      }

      // Wyjątki z dni, które nie należą już do serii (np. po przesunięciu na inny dzień tygodnia),
      // kasujemy — i odwołane, i zmienione — żeby nie wróciły przy kolejnej zmianie serii
      const { data: wyjatki } = await supabase
        .from("block_exceptions")
        .select("occurrence_date")
        .eq("block_id", block.id);
      if (!jednorazowy && wyjatki && wyjatki.length > 0) {
        const daty = wyjatki.map((w) => w.occurrence_date).sort();
        const nowyBlok = {
          ...block,
          start_local: zmiany.start_local ?? block.start_local,
          recurrence:
            zmiany.recurrence === undefined
              ? block.recurrence
              : zmiany.recurrence,
        };
        const dniSerii = new Set(
          expandOccurrences([nowyBlok], [], daty[0], daty[daty.length - 1]).map(
            (o) => o.key.slice(-10),
          ),
        );
        const sieroty = daty.filter((d) => !dniSerii.has(d));
        if (sieroty.length > 0) {
          const { error: bladWyjatkow } = await supabase
            .from("block_exceptions")
            .delete()
            .eq("block_id", block.id)
            .in("occurrence_date", sieroty);
          if (bladWyjatkow) return { ok: false, message: BLAD_ZAPISU };
        }
      }
    }
  }

  revalidatePath("/kalendarz");
  return { ok: true };
}
