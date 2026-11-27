"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import type { ActionResult } from "@/lib/action-result";
import { createClient } from "@/lib/supabase/server";
import { idSchema } from "@/features/calendar/schemas";
import { CATEGORY_COLOR_VALUES } from "./colors";

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

const nazwaSchema = z
  .string()
  .trim()
  .min(1, "Podaj nazwę kategorii.")
  .max(30, "Nazwa może mieć maksymalnie 30 znaków.");
const kolorSchema = z
  .string()
  .refine((k) => CATEGORY_COLOR_VALUES.includes(k), "Wybierz kolor z palety.");

export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ name: nazwaSchema, color: kolorSchema })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }

  // Nowa kategoria ląduje na końcu listy
  const { data: ostatnia } = await supabase
    .from("categories")
    .select("position")
    .eq("user_id", user.id)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      color: parsed.data.color,
      position: (ostatnia?.position ?? 0) + 1,
      is_system: false,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true, id: data.id };
}

// Zmiana nazwy i koloru — tylko kategorie własne, nie systemowe
export async function updateCategory(input: {
  id: string;
  name?: string;
  color?: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({
      id: idSchema,
      name: nazwaSchema.optional(),
      color: kolorSchema.optional(),
    })
    .safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? BLAD_ZAPISU,
    };
  }
  const dane = parsed.data;

  const { data: kategoria } = await supabase
    .from("categories")
    .select("id, is_system")
    .eq("id", dane.id)
    .maybeSingle();
  if (!kategoria || kategoria.is_system) {
    return { ok: false, message: "Tej kategorii nie można edytować." };
  }

  const zmiany: { name?: string; color?: string } = {};
  if (dane.name !== undefined) zmiany.name = dane.name;
  if (dane.color !== undefined) zmiany.color = dane.color;

  const { data, error } = await supabase
    .from("categories")
    .update(zmiany)
    .eq("id", dane.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true };
}

// Ukrywanie działa także dla kategorii systemowych
export async function setCategoryHidden(input: {
  id: string;
  hidden: boolean;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ id: idSchema, hidden: z.boolean() })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("categories")
    .update({ hidden: parsed.data.hidden })
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true };
}

// Zamienia pozycję kategorii z sąsiadem (-1 = wyżej, 1 = niżej); także dla systemowych
export async function moveCategory(input: {
  id: string;
  dir: -1 | 1;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z
    .object({ id: idSchema, dir: z.union([z.literal(-1), z.literal(1)]) })
    .safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  // Zamiana pozycji w jednej transakcji po stronie bazy (bez wyścigów)
  const { error } = await supabase.rpc("move_category", {
    p_id: parsed.data.id,
    p_dir: parsed.data.dir,
  });
  if (error) return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true };
}

// Usuwanie tylko kategorii własnych (bloki tracą kategorię przez ON DELETE SET NULL)
export async function deleteCategory(input: {
  id: string;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = z.object({ id: idSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: kategoria } = await supabase
    .from("categories")
    .select("id, is_system")
    .eq("id", parsed.data.id)
    .maybeSingle();
  if (!kategoria || kategoria.is_system) {
    return { ok: false, message: "Tej kategorii nie można usunąć." };
  }

  const { data, error } = await supabase
    .from("categories")
    .delete()
    .eq("id", parsed.data.id)
    .select("id");
  if (error || !data || data.length === 0)
    return { ok: false, message: BLAD_ZAPISU };

  revalidatePath("/kalendarz");
  revalidatePath("/ustawienia/kalendarz");
  return { ok: true };
}
