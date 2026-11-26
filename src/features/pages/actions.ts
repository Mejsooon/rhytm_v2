"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { isSecretValue } from "@/features/vault/crypto";
import { normalizeValue } from "./fields";
import { BLAD_ZAPISU, IMPORT_HASLA, SEJF_ZABLOKOWANY, SEJF_ZMIENIL_SIE, SEKRET_ZA_DLUGI } from "./messages";
import type { CellValue, FieldConfig, FieldOption, FieldType, PageField } from "./fields";
import type { BlockType, LoadedBlock } from "./load-page";
import {
  blockContentSchema,
  blockTypeSchema,
  fieldConfigSchema,
  fieldNameSchema,
  fieldTypeSchema,
  idSchema,
  importNewFieldsSchema,
  importOptionsSchema,
  importRowsSchema,
  pageIconSchema,
  pageTitleSchema,
  rowIdsSchema,
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
const SEKRET_TYP = "Nie można zmienić typu pola Sekret.";
const SEKRET_TYLKO_HASLA = "Pole Sekret jest dostępne tylko na stronie Hasła.";

// code: stale_generation = zapis Sekretu z inną generacją sejfu (klient blokuje sejf po kodzie, nie po treści)
type Blad = { ok: false; message: string; code?: "stale_generation" };

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
    p_icon: "",
    p_template_key: null,
    p_blocks: [],
  });
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  revalidatePath("/", "layout");
  return { ok: true, id: data };
}

// Strona-tabela z szablonu; pusty tytuł → nazwa szablonu (pusta strona: bez nazwy i bez ikony)
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
    // Pusta strona bez nazwy zostaje „Bez tytułu” i bez ikony (S2EmptyPage: „Dodaj ikonę”)
    p_title: tytul.data.trim() !== "" ? tytul.data.trim() : klucz.data === "empty" ? "" : szablon.name,
    p_icon: klucz.data === "empty" ? "" : szablon.icon,
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

// Przeniesienie strony między sekcjami sidebaru: ulubione i pełna kolejność jednym wywołaniem (jedna transakcja)
export async function movePage(
  ids: string[],
  pageId: string,
  favorite: boolean,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const dane = z
    .object({ ids: z.array(idSchema).max(500), pageId: idSchema, favorite: z.boolean() })
    .refine((d) => d.ids.includes(d.pageId), { message: BLAD_ZAPISU })
    .safeParse({ ids, pageId, favorite });
  if (!dane.success) return { ok: false, message: dane.error.issues[0].message };

  const { error } = await supabase.rpc("move_page", {
    p_ids: dane.data.ids,
    p_page_id: dane.data.pageId,
    p_favorite: dane.data.favorite,
  });
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

  // Pole Sekret istnieje tylko w module Hasła (baza i tak odrzuca je poza stroną systemową)
  if (typ.data === "secret") return { ok: false, message: SEKRET_TYLKO_HASLA };

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
    .record(
      idSchema,
      z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        // Kwota cykliczna
        z.object({ amount: z.number(), cycle: z.enum(["month", "year"]) }),
      ]),
    )
    .safeParse(values ?? {});
  if (!idOk.success || !typ.success || !cfg.success || !wartosci.success) {
    return { ok: false, message: BLAD_ZAPISU };
  }

  // Na Sekret nie zmieniamy typu (zwykła wartość nie jest szyfrogramem)
  if (typ.data === "secret") return { ok: false, message: SEKRET_TYP };

  // Pola tytułowego nie wolno przekonwertować (jak w deleteField)
  const { data: pole, error: bladOdczytu } = await supabase
    .from("page_fields")
    .select("is_title, type")
    .eq("id", fieldId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (!pole) return { ok: false, message: BRAK_POLA };
  // Z Sekretu też nie: szyfrogramu nie da się przeliczyć na inny typ
  if (pole.type === "secret") return { ok: false, message: SEKRET_TYP };
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

  // Sekret: serwer sprawdza tylko kształt i generation aktywnego sejfu, niczego nie odszyfrowuje
  const maSekret = (pola ?? []).some(
    (p) => p.type === "secret" && wartosci.data[p.id] !== null && wartosci.data[p.id] !== undefined,
  );
  let sejf: { status: string; generation: number } | null = null;
  if (maSekret) {
    const { data: wierszSejfu, error: bladSejfu } = await supabase
      .from("vaults")
      .select("status, generation")
      .eq("user_id", user.id)
      .maybeSingle();
    if (bladSejfu) return { ok: false, message: BLAD_ZAPISU };
    sejf = wierszSejfu;
  }

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
    const surowaSekret = wartosci.data[p.id];
    if (pole.type === "secret" && surowaSekret !== null && surowaSekret !== undefined) {
      // String i każdy inny kształt niż SecretValue to próba zapisu jawnego tekstu
      if (!isSecretValue(surowaSekret) || sejf === null) return { ok: false, message: SEJF_ZABLOKOWANY };
      // ct ponad 8192 znaki odrzuca też strażnik w bazie; tu z dokładnym komunikatem
      if (surowaSekret.ct.length > 8192) return { ok: false, message: SEKRET_ZA_DLUGI };
      // Złe g przy istniejącym wierszu sejfu (także po resecie) = zmiana w innej karcie
      if (surowaSekret.g !== sejf.generation) return { ok: false, message: SEJF_ZMIENIL_SIE, code: "stale_generation" };
      if (sejf.status !== "active") return { ok: false, message: SEJF_ZABLOKOWANY };
    }
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

  // Sekret: serwer sprawdza tylko kształt i generation aktywnego sejfu, niczego nie odszyfrowuje
  const maSekret = Object.entries(wartosci.data).some(
    ([klucz, w]) =>
      w !== null && w !== undefined && (pola ?? []).some((f) => f.id === klucz && f.type === "secret"),
  );
  let sejf: { status: string; generation: number } | null = null;
  if (maSekret) {
    const { data: wierszSejfu, error: bladSejfu } = await supabase
      .from("vaults")
      .select("status, generation")
      .eq("user_id", user.id)
      .maybeSingle();
    if (bladSejfu) return { ok: false, message: BLAD_ZAPISU };
    sejf = wierszSejfu;
  }

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
    if (pole.type === "secret" && surowa !== null && surowa !== undefined) {
      // String i każdy inny kształt niż SecretValue to próba zapisu jawnego tekstu
      if (!isSecretValue(surowa) || sejf === null) return { ok: false, message: SEJF_ZABLOKOWANY };
      // ct ponad 8192 znaki odrzuca też strażnik w bazie; tu z dokładnym komunikatem
      if (surowa.ct.length > 8192) return { ok: false, message: SEKRET_ZA_DLUGI };
      // Złe g przy istniejącym wierszu sejfu (także po resecie) = zmiana w innej karcie
      if (surowa.g !== sejf.generation) return { ok: false, message: SEJF_ZMIENIL_SIE, code: "stale_generation" };
      if (sejf.status !== "active") return { ok: false, message: SEJF_ZABLOKOWANY };
    }
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

// ---------- Wiele wierszy naraz ----------

// Miękkie usunięcie zaznaczonych wierszy (do 500); „Cofnij” woła restoreRows
export async function deleteRows(ids: string[]): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idsOk = rowIdsSchema.safeParse(ids);
  if (!idsOk.success) return { ok: false, message: idsOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_rows")
    .update({ deleted_at: new Date().toISOString() })
    .in("id", idsOk.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

export async function restoreRows(ids: string[]): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idsOk = rowIdsSchema.safeParse(ids);
  if (!idsOk.success) return { ok: false, message: idsOk.error.issues[0].message };

  const { error } = await supabase
    .from("page_rows")
    .update({ deleted_at: null })
    .in("id", idsOk.data)
    .eq("user_id", user.id);
  if (error) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// Kopie trafiają na koniec bloku swoich wierszy (pozycje liczy serwer), w kolejności źródeł
export async function duplicateRows(
  ids: string[],
): Promise<{ ok: true; rows: { id: string; values: Record<string, unknown>; position: number }[] } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idsOk = rowIdsSchema.safeParse(ids);
  if (!idsOk.success) return { ok: false, message: idsOk.error.issues[0].message };

  const { data: zrodla, error: bladOdczytu } = await supabase
    .from("page_rows")
    .select("id, block_id, values, position, deleted_at")
    .in("id", idsOk.data)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .order("position", { ascending: true });
  if (bladOdczytu) return { ok: false, message: BLAD_ZAPISU };
  if (!zrodla || zrodla.length === 0) return { ok: false, message: BRAK_WIERSZA };

  // Bloki źródeł (i ich strony) muszą być żywe — jak przy addBlock
  const blokiIds = [...new Set(zrodla.map((z) => z.block_id))];
  const { data: zywe, error: bladBlokow } = await supabase
    .from("page_blocks")
    .select("id, pages!inner(deleted_at)")
    .in("id", blokiIds)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("pages.deleted_at", null);
  if (bladBlokow) return { ok: false, message: BLAD_ZAPISU };
  if (!zywe || zywe.length !== blokiIds.length) return { ok: false, message: BRAK_BLOKU };

  // Pole tytułu każdego bloku: kopia dostaje w tytule dopisek „ (kopia)” (S2Table, dupSel); pusty tytuł zostaje pusty
  const { data: polaTytulu, error: bladTytulu } = await supabase
    .from("page_fields")
    .select("id, block_id, is_title")
    .in("block_id", blokiIds)
    .eq("user_id", user.id)
    .eq("is_title", true);
  if (bladTytulu) return { ok: false, message: BLAD_ZAPISU };
  const tytulBloku = new Map(
    ((polaTytulu ?? []) as { id: string; block_id: string; is_title: boolean }[])
      .filter((p) => p.is_title)
      .map((p) => [p.block_id, p.id]),
  );

  // Następna wolna pozycja osobno dla każdego bloku
  const nastepna = new Map<string, number>();
  const kopie: { block_id: string; user_id: string; values: Json; position: number }[] = [];
  for (const z of zrodla) {
    if (!nastepna.has(z.block_id)) {
      const { data: ostatni, error: bladPozycji } = await supabase
        .from("page_rows")
        .select("position")
        .eq("block_id", z.block_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (bladPozycji) return { ok: false, message: BLAD_ZAPISU };
      nastepna.set(z.block_id, (ostatni?.position ?? -1) + 1);
    }
    const pozycja = nastepna.get(z.block_id) as number;
    nastepna.set(z.block_id, pozycja + 1);
    const wartosci = { ...((z.values ?? {}) as Record<string, Json>) };
    const tytul = tytulBloku.get(z.block_id);
    if (tytul !== undefined && typeof wartosci[tytul] === "string" && (wartosci[tytul] as string).trim() !== "") {
      wartosci[tytul] = `${wartosci[tytul] as string} (kopia)`;
    }
    kopie.push({ block_id: z.block_id, user_id: user.id, values: wartosci, position: pozycja });
  }

  const { data, error } = await supabase
    .from("page_rows")
    .insert(kopie)
    .select("id, values, position, deleted_at");
  if (error || !data) return { ok: false, message: BLAD_ZAPISU };
  return {
    ok: true,
    rows: data.map((w) => ({
      id: w.id,
      values: (w.values ?? {}) as Record<string, unknown>,
      position: w.position,
    })),
  };
}

// Ustawia jedno pole w wielu wierszach tego samego bloku; wartość przez normalizeValue (zły typ → puste)
export async function setRowsValue(
  ids: string[],
  fieldId: string,
  value: unknown,
): Promise<{ ok: true } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idsOk = rowIdsSchema.safeParse(ids);
  const poleOk = idSchema.safeParse(fieldId);
  if (!idsOk.success) return { ok: false, message: idsOk.error.issues[0].message };
  if (!poleOk.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: p, error: bladPola } = await supabase
    .from("page_fields")
    .select("id, block_id, name, type, config, position, is_title")
    .eq("id", fieldId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (bladPola) return { ok: false, message: BLAD_ZAPISU };
  if (!p) return { ok: false, message: BRAK_POLA };
  // Szyfrogramy powstają tylko w przeglądarce przy odblokowanym sejfie, nie hurtowo
  if (p.type === "secret") return { ok: false, message: SEKRET_TYP };

  const pole: PageField = {
    id: p.id,
    name: p.name,
    type: p.type as FieldType,
    config: p.config as FieldConfig,
    position: p.position,
    isTitle: p.is_title,
  };
  let nowa = normalizeValue(pole, value);
  if (pole.isTitle && nowa === null) nowa = pole.config.empty_label ?? BEZ_TYTULU;

  // Tylko żywe wiersze z bloku tego pola; każdy wiersz musi się znaleźć
  const unikalne = [...new Set(idsOk.data)];
  const { data: wiersze, error: bladWierszy } = await supabase
    .from("page_rows")
    .select("id, values")
    .in("id", unikalne)
    .eq("block_id", p.block_id)
    .eq("user_id", user.id)
    .is("deleted_at", null);
  if (bladWierszy) return { ok: false, message: BLAD_ZAPISU };
  if (!wiersze || wiersze.length !== unikalne.length) return { ok: false, message: BRAK_WIERSZA };

  const wyniki = await Promise.all(
    wiersze.map((w) =>
      supabase
        .from("page_rows")
        .update({ values: { ...((w.values ?? {}) as Record<string, unknown>), [pole.id]: nowa } as Json })
        .eq("id", w.id)
        .eq("user_id", user.id),
    ),
  );
  if (wyniki.some((w) => w.error)) return { ok: false, message: BLAD_ZAPISU };
  return { ok: true };
}

// Import CSV w jednej akcji: nowe pola na końcu, nowe opcje wyboru, potem wiersze po ostatnim.
// W wierszach klucz „new:<indeks>” wskazuje nowe pole (kolejność newFields); pola Sekret są pomijane.
// newOptions: klucz = id istniejącego pola wyboru albo „new:<indeks>”.
// Bez transakcji: przy błędzie po pierwszym zapisie akcja sprząta po sobie (best effort) — kasuje wstawione
// wiersze i pola utworzone w tym wywołaniu oraz przywraca dawne opcje rozszerzonych pól.
export async function importCsvRows(
  blockId: string,
  newFields: { name: string; type: FieldType }[],
  rows: Record<string, unknown>[],
  newOptions: Record<string, FieldOption[]> = {},
): Promise<{ ok: true; fieldIds: string[]; count: number } | Blad> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const idOk = idSchema.safeParse(blockId);
  const nowePola = importNewFieldsSchema.safeParse(newFields ?? []);
  const wiersze = importRowsSchema.safeParse(rows ?? []);
  const opcje = importOptionsSchema.safeParse(newOptions ?? {});
  if (!idOk.success) return { ok: false, message: idOk.error.issues[0].message };
  if (!wiersze.success) return { ok: false, message: wiersze.error.issues[0].message };
  if (!nowePola.success || !opcje.success) return { ok: false, message: BLAD_ZAPISU };

  const { data: blok, error: bladBloku } = await supabase
    .from("page_blocks")
    .select("type, page_id")
    .eq("id", blockId)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (bladBloku) return { ok: false, message: BLAD_ZAPISU };
  if (!blok || blok.type !== "table") return { ok: false, message: BRAK_BLOKU };

  // Strona systemowa (Hasła) ma stałe kolumny i nie przyjmuje importu
  const { data: strona, error: bladStrony } = await supabase
    .from("pages")
    .select("is_system")
    .eq("id", blok.page_id)
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (bladStrony) return { ok: false, message: BLAD_ZAPISU };
  if (!strona) return { ok: false, message: BRAK_STRONY };
  if (strona.is_system) return { ok: false, message: IMPORT_HASLA };

  const { data: istniejace, error: bladPol } = await supabase
    .from("page_fields")
    .select("id, name, type, config, position, is_title")
    .eq("block_id", blockId);
  if (bladPol) return { ok: false, message: BLAD_ZAPISU };

  const pola: PageField[] = [];
  const kluczePol: string[] = [];
  let ostatniaPozycjaPola = -1;
  // Ślad zapisów do wycofania przy błędzie
  const stareConfigi: { id: string; config: Json }[] = [];
  const noweIds: string[] = [];
  const wstawioneIds: string[] = [];
  const wycofaj = async () => {
    if (wstawioneIds.length > 0) {
      await supabase.from("page_rows").delete().in("id", wstawioneIds).eq("user_id", user.id);
    }
    if (noweIds.length > 0) {
      await supabase.from("page_fields").delete().in("id", noweIds).eq("user_id", user.id);
    }
    for (const s of stareConfigi) {
      await supabase.from("page_fields").update({ config: s.config }).eq("id", s.id).eq("user_id", user.id);
    }
  };
  for (const p of istniejace ?? []) {
    ostatniaPozycjaPola = Math.max(ostatniaPozycjaPola, p.position);
    let config = p.config as FieldConfig;
    const dodatkowe = opcje.data[p.id];
    if ((p.type === "select" || p.type === "status") && dodatkowe && dodatkowe.length > 0) {
      // Nowe opcje dochodzą na koniec, bez duplikatów id i do limitu 100
      const stare = config.options ?? [];
      const doDodania = dodatkowe.filter((o) => !stare.some((s) => s.id === o.id)).slice(0, 100 - stare.length);
      if (doDodania.length > 0) {
        stareConfigi.push({ id: p.id, config: p.config });
        config = { ...config, options: [...stare, ...doDodania] };
        const { error: bladOpcji } = await supabase
          .from("page_fields")
          .update({ config: config as Json })
          .eq("id", p.id)
          .eq("user_id", user.id);
        if (bladOpcji) {
          await wycofaj();
          return { ok: false, message: BLAD_ZAPISU };
        }
      }
    }
    pola.push({
      id: p.id,
      name: p.name,
      type: p.type as FieldType,
      config,
      position: p.position,
      isTitle: p.is_title,
    });
    kluczePol.push(p.id);
  }

  for (let i = 0; i < nowePola.data.length; i++) {
    const nowe = nowePola.data[i];
    const config: FieldConfig =
      (nowe.type === "select" || nowe.type === "status") && opcje.data[`new:${i}`]
        ? { options: opcje.data[`new:${i}`] }
        : {};
    const { data, error } = await supabase
      .from("page_fields")
      .insert({
        block_id: blockId,
        user_id: user.id,
        name: nowe.name,
        type: nowe.type,
        config: config as Json,
        position: ostatniaPozycjaPola + 1 + i,
        is_title: false,
      })
      .select("id, name, type, config, position, is_title")
      .single();
    if (error || !data) {
      await wycofaj();
      return { ok: false, message: BLAD_ZAPISU };
    }
    noweIds.push(data.id);
    pola.push({
      id: data.id,
      name: data.name,
      type: data.type as FieldType,
      config: data.config as FieldConfig,
      position: data.position,
      isTitle: data.is_title,
    });
    kluczePol.push(`new:${i}`);
  }

  const { data: ostatni, error: bladPozycji } = await supabase
    .from("page_rows")
    .select("position")
    .eq("block_id", blockId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (bladPozycji) {
    await wycofaj();
    return { ok: false, message: BLAD_ZAPISU };
  }
  const pierwsza = (ostatni?.position ?? -1) + 1;

  // Wartości przez normalizeValue; puste komórki nie są zapisywane, pusty tytuł dostaje etykietę pola
  const doWstawienia: { block_id: string; user_id: string; values: Json; position: number }[] = [];
  for (let r = 0; r < wiersze.data.length; r++) {
    const surowy = wiersze.data[r];
    const wartosci: Record<string, CellValue> = {};
    for (let i = 0; i < pola.length; i++) {
      const pole = pola[i];
      if (pole.type === "secret") continue;
      let v = normalizeValue(pole, surowy[kluczePol[i]]);
      // Kolumna bez mapowania (brak klucza w wierszu) dostaje wartość domyślną pola, jak w „Nowy wiersz”
      if (!(kluczePol[i] in surowy)) {
        const domyslna = pole.config.default_option;
        if (
          (pole.type === "select" || pole.type === "status") &&
          domyslna !== undefined &&
          (pole.config.options ?? []).some((o) => o.id === domyslna)
        ) {
          v = domyslna;
        }
        if (pole.type === "checkbox" && pole.config.default_checked === true) v = true;
      }
      if (pole.isTitle && v === null) v = pole.config.empty_label ?? BEZ_TYTULU;
      if (v !== null) wartosci[pole.id] = v;
    }
    doWstawienia.push({ block_id: blockId, user_id: user.id, values: wartosci as Json, position: pierwsza + r });
  }
  for (let od = 0; od < doWstawienia.length; od += 500) {
    const { data, error } = await supabase
      .from("page_rows")
      .insert(doWstawienia.slice(od, od + 500))
      .select("id");
    if (error || !data) {
      await wycofaj();
      return { ok: false, message: BLAD_ZAPISU };
    }
    for (const w of data) wstawioneIds.push(w.id);
  }
  return { ok: true, fieldIds: noweIds, count: doWstawienia.length };
}

// ---------- Ustawienia tabeli ----------

// Scala podane klucze z content.settings bloku tabeli (pozostałe ustawienia zostają).
// opts.onlyIfMissing "views": zapis tylko wtedy, gdy w zapisanych ustawieniach nie ma jeszcze klucza `views`
// (jednorazowe widoki szablonu nie nadpisują widoków zapisanych w międzyczasie); wtedy wynik ma skipped: true
export async function saveTableSettings(
  blockId: string,
  patch: Partial<TableSettings>,
  opts?: { onlyIfMissing?: "views" },
): Promise<{ ok: true; skipped?: true } | Blad> {
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
  const zapisane = (tresc.settings ?? {}) as Record<string, unknown>;
  if (opts?.onlyIfMissing && opts.onlyIfMissing in zapisane) return { ok: true, skipped: true };
  const ustawienia = {
    ...zapisane,
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
