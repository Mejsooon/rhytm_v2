"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { IsoDate } from "@/components/controls/calendar-math";
import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import {
  idSchema,
  isoDateSchema,
  zadanieTytul,
} from "@/features/calendar/schemas";
import { loadOccurrence } from "@/features/calendar/load-occurrence";
import { pinTask, unpinTask as unpinTaskFields } from "./model";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";
const NIE_ZNALEZIONO = "Nie znaleziono wystąpienia bloku.";

// Dodaje zadanie do wystąpienia bloku. `date` to oryginalna data wystąpienia.
export async function addTask(input: {
  blockId: string;
  date: IsoDate;
  title: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ blockId: idSchema, date: isoDateSchema, title: zadanieTytul })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }
  const dane = parsed.data;

  // Termin zadania = dzień, na którym wystąpienie jest pokazane (mogło zostać przesunięte)
  const wczytane = await loadOccurrence(supabase, dane.blockId, dane.date);
  if (!wczytane) return { ok: false, message: NIE_ZNALEZIONO };

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: dane.title,
      block_id: dane.blockId,
      occurrence_date: dane.date,
      due_date: wczytane.occurrence.date,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true, id: data.id };
}

// Zaznacza / odznacza zadanie; done_at ustawiamy tylko dla zrobionego
export async function toggleTask(input: {
  id: string;
  done: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z.object({ id: idSchema, done: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("tasks")
    .update({
      done: parsed.data.done,
      done_at: parsed.data.done ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true };
}

export async function renameTask(input: {
  id: string;
  title: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ id: idSchema, title: zadanieTytul })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .update({ title: parsed.data.title })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true };
}

export async function deleteTask(input: { id: string }): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("tasks")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true };
}

// Zadanie bez bloku, z terminem albo bez
export async function createStandaloneTask(input: {
  title: string;
  dueDate: IsoDate | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ title: zadanieTytul, dueDate: isoDateSchema.nullable() })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  const { data, error } = await supabase
    .from("tasks")
    .insert({
      user_id: user.id,
      title: parsed.data.title,
      due_date: parsed.data.dueDate,
      block_id: null,
      occurrence_date: null,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true, id: data.id };
}

// Przypina zadanie do wystąpienia bloku. `date` to oryginalna data wystąpienia.
export async function pinTaskToOccurrence(input: {
  taskId: string;
  blockId: string;
  date: IsoDate;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ taskId: idSchema, blockId: idSchema, date: isoDateSchema })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };
  const dane = parsed.data;

  const { data: zadanie } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", dane.taskId)
    .maybeSingle();
  if (!zadanie) return { ok: false, message: BLAD_ZAPISU };

  const wczytane = await loadOccurrence(supabase, dane.blockId, dane.date);
  if (!wczytane) return { ok: false, message: NIE_ZNALEZIONO };

  const { data, error } = await supabase
    .from("tasks")
    .update(pinTask(zadanie, wczytane.occurrence))
    .eq("id", dane.taskId)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true };
}

// Odpina zadanie od bloku; termin zostaje
export async function unpinTask(input: {
  taskId: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z.object({ taskId: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: zadanie } = await supabase
    .from("tasks")
    .select("*")
    .eq("id", parsed.data.taskId)
    .maybeSingle();
  if (!zadanie) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("tasks")
    .update(unpinTaskFields(zadanie))
    .eq("id", parsed.data.taskId)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  return { ok: true };
}
