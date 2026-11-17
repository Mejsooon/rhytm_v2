// Wczytuje blok i buduje wystąpienie dla ORYGINALNEJ daty (z klucza wystąpienia).
// Działa na sesji użytkownika, więc RLS ukrywa cudze bloki (wtedy zwracamy null).
import type { SupabaseClient } from "@supabase/supabase-js";
import type { IsoDate } from "@/components/controls/calendar-math";
import type { Database } from "@/types/database";
import {
  expandOccurrences,
  type BlockRow,
  type Occurrence,
} from "./occurrences";

export async function loadOccurrence(
  supabase: SupabaseClient<Database>,
  blockId: string,
  date: IsoDate,
): Promise<{ block: BlockRow; occurrence: Occurrence } | null> {
  const { data: block } = await supabase
    .from("blocks")
    .select("*")
    .eq("id", blockId)
    .maybeSingle();
  if (!block) return null;

  const { data: wyjatki } = await supabase
    .from("block_exceptions")
    .select("*")
    .eq("block_id", blockId)
    .eq("occurrence_date", date);
  const listaWyjatkow = wyjatki ?? [];

  // Wystąpienie mogło zostać przeniesione na inny dzień — zakres obejmuje oba dni
  const nowyStart = listaWyjatkow[0]?.new_start_local;
  const nowyDzien = nowyStart ? nowyStart.slice(0, 10) : date;
  const od = nowyDzien < date ? nowyDzien : date;
  const doDnia = nowyDzien > date ? nowyDzien : date;

  const wystapienie = expandOccurrences([block], listaWyjatkow, od, doDnia).find(
    (o) => o.key === `${blockId}:${date}`,
  );
  if (!wystapienie) return null; // data poza serią albo wystąpienie odwołane

  return { block, occurrence: wystapienie };
}
