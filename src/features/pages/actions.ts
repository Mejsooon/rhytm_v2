"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { normalizeValue } from "./fields";
import { BLAD_ZAPISU } from "./messages";
import type { CellValue, FieldConfig, FieldType, PageField } from "./fields";
import type { BlockType, LoadedBlock } from "./load-page";
import {
  blockContentSchema,
  blockTypeSchema,
  fieldConfigSchema,
  fieldNameSchema,
  fieldTypeSchema,
  idSchema,
  pageIconSchema,
  pageTitleSchema,
  rowValuesSchema,
  tableSettingsPatchSchema,
} from "./schemas";
import type { PageRow, TableSettings } from "./table-model";
import {
  buildTemplateBlocks,
  NEW_TABLE_BLOCK,
  TEMPLATE_KEYS,
  TEMPLATES,
  type TemplateKey,
} from "./templates";
import { z } from "zod";

const BRAK_STRONY = "Nie znaleziono strony.";
const BRAK_BLOKU = "Nie znaleziono bloku.";
const BRAK_POLA = "Nie znaleziono pola.";
const BRAK_WIERSZA = "Nie znaleziono wiersza.";
const POLE_TYTULOWE_TYP = "Typu pola tytułowego nie można zmienić.";
const BEZ_TYTULU = "Bez tytułu";

type Blad = { ok: false; message: string };

const szablonSchema = z.enum(TEMPLATE_KEYS);

// ---------- Strony ----------

// Pusta strona edytora (template_key null, tytuł ''); w sidebarze wyświetla się jako „Bez tytułu”
export async function createBlankPage(): Promise<{ ok: true; id: string } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data, error } = await supabase.rpc("create_page", {
    p_title: "",
    p_icon: "▦",
    p_template_key: null,
    p_blocks: [],
  });
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

// Strona-tabela z szablonu; pusty tytuł → nazwa szablonu
export async function createPageFromTemplate(
  key: TemplateKey,
  title: string,
): Promise<{ ok: true; id: string } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const klucz = szablonSchema.safeParse(key);
  const tytul = pageTitleSchema.safeParse(title);
  if (!klucz.success) return { ok: false, message: BLAD_ZAPISU };
  if (!tytul.success) return { ok: false, message: tytul.error.issues[0].message };

  const szablon = TEMPLATES[klucz.data];
  const { data, error } = await supabase.rpc("create_page", {
    p_title: tytul.data.trim() === "" ? szablon.name : tytul.data.trim(),
    p_icon: szablon.icon,
    p_template_key: klucz.data,
    p_blocks: buildTemplateBlocks(klucz.data, () => crypto.randomUUID()) as unknown as Json,
  });
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

export async function renamePage(id: string, title: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  const tytul = pageTitleSchema.safeParse(title);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };
  if (!tytul.success) return { ok: false, message: tytul.error.issues[0].message };

  const { error } = await supabase
    .from("pages")
    .update({ title: tytul.data.trim() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setPageIcon(id: string, icon: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  const ikona = pageIconSchema.safeParse(icon);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };
  if (!ikona.success) return { ok: false, message: ikona.error.issues[0].message };

  const { error } = await supabase
    .from("pages")
    .update({ icon: ikona.data })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function setFavorite(id: string, on: boolean): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  if (!idOk.success || !z.boolean().safeParse(on).success) return { ok: false, message: BLAD_ZAPISU };

  const { error } = await supabase
    .from("pages")
    .update({ favorite: on })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reorderPages(ids: string[]): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const lista = z.array(idSchema).max(500).safeParse(ids);
  if (!lista.success) return { ok: false, message: lista.error.issues[0].message };

  const { error } = await supabase.rpc("reorder_pages", { p_ids: lista.data });
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function duplicatePage(id: string): Promise<{ ok: true; id: string } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { data, error } = await supabase.rpc("duplicate_page", { p_page_id: id });
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

// Usunięcie to deleted_at = now(); „Cofnij” woła restorePage
export async function deletePage(id: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("pages")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

// Liczba żywych wierszy w żywych tabelach strony (okno potwierdzenia usunięcia czyta ją na świeżo)
export async function countPageRows(pageId: string): Promise<{ ok: true; count: number } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(pageId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { count, error } = await supabase
    .from("page_rows")
    .select("id, page_blocks!inner(page_id, deleted_at)", { count: "exact", head: true })
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .eq("page_blocks.page_id", pageId)
    .is("page_blocks.deleted_at", null);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true, count: count ?? 0 };
}

export async function restorePage(id: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(id);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("pages")
    .update({ deleted_at: null })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Bloki ----------

// Nowy blok na końcu strony; tabela z NEW_TABLE_BLOCK (pola + dwa puste wiersze)
export async function addBlock(
  pageId: string,
  type: BlockType,
  text?: string,
): Promise<{ ok: true; block: LoadedBlock } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(pageId);
  const typ = blockTypeSchema.safeParse(type);
  const tekst = z.string().max(10000).optional().safeParse(text);
  if (!idOk.success || !typ.success || !tekst.success) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  const { data: strona, error: bladStrony } = await supabase
    .from("pages")
    .select("id")
    .eq("id", pageId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (bladStrony) return { ok: false, message: BLAD_ZAPISU };
  if (!strona) return { ok: false, message: BRAK_STRONY };

  const { data: ostatni, error: bladPozycji } = await supabase
    .from("page_blocks")
    .select("position")
    .eq("page_id", pageId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bladPozycji) return { ok: false, message: BLAD_ZAPISU };
  const position = (ostatni?.position ?? -1) + 1;

  let content: Record<string, unknown> = {};
  if (typ.data === "text" || typ.data === "heading") content = { text: tekst.data ?? "" };
  if (typ.data === "todo") content = { text: tekst.data ?? "", done: false };

  // Blok tabeli: pola i wiersze z szablonu NEW_TABLE_BLOCK
  if (typ.data === "table") {
    const tabela = NEW_TABLE_BLOCK(() => crypto.randomUUID());
    const { error: bladBloku } = await supabase.from("page_blocks").insert({
      id: tabela.id,
      page_id: pageId,
      user_id: user.id,
      type: "table",
      position,
      content: tabela.content as Json,
    });
    if (bladBloku) return { ok: false, message: BLAD_ZAPISU };

    const { error: bladPol } = await supabase.from("page_fields").insert(
      tabela.fields.map((f, i) => ({
        id: f.id,
        block_id: tabela.id,
        user_id: user.id,
        name: f.name,
        type: f.type,
        config: f.config as Json,
        position: i,
        is_title: f.is_title,
      })),
    );
    const { data: wiersze, error: bladWierszy } = bladPol
      ? { data: null, error: bladPol }
      : await supabase
          .from("page_rows")
          .insert(
            tabela.rows.map((w, i) => ({
              block_id: tabela.id,
              user_id: user.id,
              values: w.values as Json,
              position: i,
            })),
          )
          .select("id, values, position, deleted_at");
    if (bladPol || bladWierszy) {
      // Nie zostawiamy bloku bez pól (kaskada usuwa też pola i wiersze)
      await supabase.from("page_blocks").delete().eq("id", tabela.id);
      return { ok: false, message: BLAD_ZAPISU };
    }

    return {
      ok: true,
      block: {
        id: tabela.id,
        type: "table",
        position,
        content: tabela.content,
        fields: tabela.fields.map((f, i) => ({
          id: f.id,
          name: f.name,
          type: f.type,
          config: f.config,
          position: i,
          isTitle: f.is_title,
        })),
        rows: (wiersze ?? []).map((w) => ({
          id: w.id,
          values: (w.values ?? {}) as Record<string, unknown>,
          position: w.position,
          deletedAt: w.deleted_at,
        })),
      },
    };
  }

  const { data: blok, error } = await supabase
    .from("page_blocks")
    .insert({
      page_id: pageId,
      user_id: user.id,
      type: typ.data,
      position,
      content: content as Json,
    })
    .select("id, position, content")
    .single();
  if (error || !blok) return { ok: false, message: BLAD_ZAPISU };
  return {
    ok: true,
    block: {
      id: blok.id,
      type: typ.data,
      position: blok.position,
      content: (blok.content ?? {}) as Record<string, unknown>,
      fields: [],
      rows: [],
    },
  };
}

// Zawartość bloku; w tabeli ustawienia (settings) zmienia tylko saveTableSettings,
// więc zostają te z bazy, a nie z (możliwie nieaktualnego) klienta
export async function updateBlockContent(
  blockId: string,
  content: Record<string, unknown>,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const tresc = blockContentSchema.safeParse(content);
  if (!idOk.success || !tresc.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: blok, error: bladOdczytu } = await supabase
    .from("page_blocks")
    .select("type, content")
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (!blok) return { ok: false, message: BRAK_BLOKU };

  const nowa: Record<string, unknown> = { ...tresc.data };
  if (blok.type === "table") {
    const stara = (blok.content ?? {}) as Record<string, unknown>;
    if (stara.settings !== undefined) nowa.settings = stara.settings;
    else delete nowa.settings;
  }

  const { error } = await supabase
    .from("page_blocks")
    .update({ content: nowa as Json })
    .eq("id", blockId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function deleteBlock(blockId: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_blocks")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", blockId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function restoreBlock(blockId: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_blocks")
    .update({ deleted_at: null })
    .eq("id", blockId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// ---------- Pola ----------

export async function addField(
  blockId: string,
  input: { name: string; type: FieldType; config: FieldConfig },
): Promise<{ ok: true; field: PageField } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const nazwa = fieldNameSchema.safeParse(input?.name);
  const typ = fieldTypeSchema.safeParse(input?.type);
  const config = fieldConfigSchema.safeParse(input?.config ?? {});
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };
  if (!nazwa.success) return { ok: false, message: nazwa.error.issues[0].message };
  if (!typ.success || !config.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: ostatnie, error: bladPozycji } = await supabase
    .from("page_fields")
    .select("position")
    .eq("block_id", blockId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bladPozycji) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("page_fields")
    .insert({
      block_id: blockId,
      user_id: user.id,
      name: nazwa.data,
      type: typ.data,
      config: config.data as Json,
      position: (ostatnie?.position ?? -1) + 1,
      is_title: false,
    })
    .select("id, name, type, config, position, is_title")
    .single();
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  return {
    ok: true,
    field: {
      id: data.id,
      name: data.name,
      type: data.type as FieldType,
      config: data.config as FieldConfig,
      position: data.position,
      isTitle: data.is_title,
    },
  };
}

export async function updateField(
  fieldId: string,
  patch: { name?: string; config?: FieldConfig },
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(fieldId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const zmiany: { name?: string; config?: Json } = {};
  if (patch?.name !== undefined) {
    const nazwa = fieldNameSchema.safeParse(patch.name);
    if (!nazwa.success) return { ok: false, message: nazwa.error.issues[0].message };
    zmiany.name = nazwa.data;
  }
  if (patch?.config !== undefined) {
    const config = fieldConfigSchema.safeParse(patch.config);
    if (!config.success) return { ok: false, message: BLAD_ZAPISU };
    zmiany.config = config.data as Json;
  }
  if (Object.keys(zmiany).length === 0) return { ok: false, message: BLAD_ZAPISU };

  const { error } = await supabase
    .from("page_fields")
    .update(zmiany)
    .eq("id", fieldId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// Zmiana typu: pole i wartości wszystkich wierszy w jednej transakcji (RPC)
export async function changeFieldType(
  fieldId: string,
  type: FieldType,
  config: FieldConfig,
  values: Record<string, CellValue>,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(fieldId);
  const typ = fieldTypeSchema.safeParse(type);
  const cfg = fieldConfigSchema.safeParse(config ?? {});
  const wartosci = z
    .record(idSchema, z.union([z.string(), z.number(), z.boolean(), z.null()]))
    .safeParse(values ?? {});
  if (!idOk.success || !typ.success || !cfg.success || !wartosci.success) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  // Pola tytułowego nie wolno przekonwertować (jak w deleteField)
  const { data: pole, error: bladOdczytu } = await supabase
    .from("page_fields")
    .select("is_title")
    .eq("id", fieldId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (!pole) return { ok: false, message: BRAK_POLA };
  if (pole.is_title) return { ok: false, message: POLE_TYTULOWE_TYP };

  const { error } = await supabase.rpc("change_field_type", {
    p_field_id: fieldId,
    p_type: typ.data,
    p_config: cfg.data as Json,
    p_values: wartosci.data as Json,
  });
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function reorderFields(
  blockId: string,
  ids: string[],
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const lista = z.array(idSchema).max(200).safeParse(ids);
  if (!idOk.success || !lista.success) return { ok: false, message: BLAD_ZAPISU };

  const { error } = await supabase.rpc("reorder_fields", {
    p_block_id: blockId,
    p_ids: lista.data,
  });
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// Usuwa pole (nie tytułowe) wraz ze śladami w values i ustawieniach bloku — atomowo w RPC delete_field
export async function deleteField(fieldId: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(fieldId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase.rpc("delete_field", { p_field_id: fieldId });
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// ---------- Wiersze ----------

export async function addRow(
  blockId: string,
  values: Record<string, unknown>,
): Promise<{ ok: true; row: PageRow } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const wartosci = rowValuesSchema.safeParse(values ?? {});
  if (!idOk.success || !wartosci.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: pola, error: bladPol } = await supabase
    .from("page_fields")
    .select("id, name, type, config, position, is_title")
    .eq("block_id", blockId);
  if (bladPol) return { ok: false, message: BLAD_ZAPISU };

  // Wartości przez normalizeValue; puste pole tytułowe dostaje etykietę (empty_label)
  const nowe: Record<string, CellValue> = {};
  for (const p of pola ?? []) {
    const pole: PageField = {
      id: p.id,
      name: p.name,
      type: p.type as FieldType,
      config: p.config as FieldConfig,
      position: p.position,
      isTitle: p.is_title,
    };
    if (!(p.id in wartosci.data) && !pole.isTitle) continue;
    let v = normalizeValue(pole, wartosci.data[p.id]);
    if (pole.isTitle && v === null) v = pole.config.empty_label ?? BEZ_TYTULU;
    nowe[p.id] = v;
  }

  const { data: ostatni, error: bladPozycji } = await supabase
    .from("page_rows")
    .select("position")
    .eq("block_id", blockId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bladPozycji) return { ok: false, message: BLAD_ZAPISU };

  const { data, error } = await supabase
    .from("page_rows")
    .insert({
      block_id: blockId,
      user_id: user.id,
      values: nowe as Json,
      position: (ostatni?.position ?? -1) + 1,
    })
    .select("id, values, position, deleted_at")
    .single();
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  return {
    ok: true,
    row: {
      id: data.id,
      values: (data.values ?? {}) as Record<string, unknown>,
      position: data.position,
      deletedAt: data.deleted_at,
    },
  };
}

// Zmienia tylko podane komórki; wartości przez normalizeValue (błędny typ → null),
// pusty tytuł → empty_label pola, nieznane klucze są pomijane
export async function updateRow(
  rowId: string,
  values: Record<string, unknown>,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(rowId);
  const wartosci = rowValuesSchema.safeParse(values);
  if (!idOk.success || !wartosci.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: wiersz, error: bladWiersza } = await supabase
    .from("page_rows")
    .select("block_id, values")
    .eq("id", rowId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladWiersza) return { ok: false, message: BLAD_ZAPISU };
  if (!wiersz) return { ok: false, message: BRAK_WIERSZA };

  const { data: pola, error: bladPol } = await supabase
    .from("page_fields")
    .select("id, name, type, config, position, is_title")
    .eq("block_id", wiersz.block_id);
  if (bladPol) return { ok: false, message: BLAD_ZAPISU };

  const nowe = { ...((wiersz.values ?? {}) as Record<string, unknown>) };
  for (const [klucz, surowa] of Object.entries(wartosci.data)) {
    const p = (pola ?? []).find((f) => f.id === klucz);
    if (!p) continue;
    const pole: PageField = {
      id: p.id,
      name: p.name,
      type: p.type as FieldType,
      config: p.config as FieldConfig,
      position: p.position,
      isTitle: p.is_title,
    };
    let v = normalizeValue(pole, surowa);
    if (pole.isTitle && v === null) v = pole.config.empty_label ?? BEZ_TYTULU;
    nowe[klucz] = v;
  }

  const { error } = await supabase
    .from("page_rows")
    .update({ values: nowe as Json })
    .eq("id", rowId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function deleteRow(rowId: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(rowId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_rows")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", rowId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function restoreRow(rowId: string): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(rowId);
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_rows")
    .update({ deleted_at: null })
    .eq("id", rowId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// ---------- Ustawienia tabeli ----------

// Scala podane klucze z content.settings bloku tabeli (pozostałe ustawienia zostają)
export async function saveTableSettings(
  blockId: string,
  patch: Partial<TableSettings>,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const zmiany = tableSettingsPatchSchema.safeParse(patch);
  if (!idOk.success || !zmiany.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: blok, error: bladOdczytu } = await supabase
    .from("page_blocks")
    .select("type, content")
    .eq("id", blockId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (!blok || blok.type !== "table") return { ok: false, message: BRAK_BLOKU };

  const tresc = (blok.content ?? {}) as Record<string, unknown>;
  const ustawienia = {
    ...((tresc.settings ?? {}) as Record<string, unknown>),
    ...zmiany.data,
  };
  const { error } = await supabase
    .from("page_blocks")
    .update({ content: { ...tresc, settings: ustawienia } as Json })
    .eq("id", blockId)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// ---------- Kosz ----------

export type TrashData = {
  pages: { id: string; title: string; deletedAt: string }[];
  rows: { id: string; title: string; pageTitle: string; deletedAt: string }[];
};

// Usunięte strony oraz usunięte wiersze z żywych tabel żywych stron, od najnowszych
export async function loadTrash(): Promise<({ ok: true } & TrashData) | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const [stronyRes, wierszeRes] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, deleted_at")
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .order("deleted_at", { ascending: false }),
    supabase
      .from("page_rows")
      .select(
        "id, values, deleted_at, page_blocks!inner(deleted_at, pages!inner(title, deleted_at), page_fields(id, is_title, config))",
      )
      .eq("user_id", user.id)
      .not("deleted_at", "is", null)
      .is("page_blocks.deleted_at", null)
      .is("page_blocks.pages.deleted_at", null)
      .order("deleted_at", { ascending: false })
      .limit(500),
  ]);
  if (stronyRes.error || wierszeRes.error) return { ok: false, message: BLAD_ZAPISU };

  return {
    ok: true,
    pages: (stronyRes.data ?? []).map((s) => ({
      id: s.id,
      title: s.title,
      deletedAt: s.deleted_at ?? "",
    })),
    rows: (wierszeRes.data ?? []).map((w) => {
      const tytulowe = w.page_blocks.page_fields.find((f) => f.is_title);
      const wartosc = tytulowe
        ? (w.values as Record<string, unknown>)?.[tytulowe.id]
        : null;
      return {
        id: w.id,
        title:
          typeof wartosc === "string" && wartosc.trim() !== "" ? wartosc : BEZ_TYTULU,
        pageTitle: w.page_blocks.pages.title,
        deletedAt: w.deleted_at ?? "",
      };
    }),
  };
}
