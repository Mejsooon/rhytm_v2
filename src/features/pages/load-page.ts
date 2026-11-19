// Jedna strona z blokami, polami i wierszami (edytor, strona-tabela).
import { todayIso, type IsoDate } from "@/components/controls/calendar-math";
import { createClient } from "@/lib/supabase/server";
import { safeTimezone } from "@/lib/time/timezones";
import type { FieldConfig, FieldType, PageField } from "./fields";
import type { PageSummary } from "./load-pages";
import { idSchema } from "./schemas";
import type { PageRow } from "./table-model";
import type { TemplateKey } from "./templates";

export type BlockType = "text" | "heading" | "todo" | "divider" | "table";

export type LoadedBlock = {
  id: string;
  type: BlockType;
  position: number;
  content: Record<string, unknown>;
  fields: PageField[];
  rows: PageRow[];
};

export type LoadedPage = {
  page: PageSummary & { createdAt: string };
  blocks: LoadedBlock[];
  today: IsoDate;
  currency: string;
};

const SZABLONY: string[] = ["empty", "books", "projects", "websites"];
const ROZMIAR_STRONY = 1000;

// null dla cudzej, usuniętej albo nieistniejącej strony
export async function loadPage(id: string): Promise<LoadedPage | null> {
  if (!idSchema.safeParse(id).success) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [stronaRes, profilRes, blokiRes] = await Promise.all([
    supabase
      .from("pages")
      .select("id, title, icon, favorite, template_key, position, created_at")
      .eq("id", id)
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("timezone, currency")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("page_blocks")
      .select("id, type, position, content")
      .eq("page_id", id)
      .is("deleted_at", null)
      .order("position", { ascending: true }),
  ]);
  if (stronaRes.error || !stronaRes.data) return null;
  if (blokiRes.error) return null;
  const strona = stronaRes.data;
  const bloki = blokiRes.data ?? [];
  const idBlokow = bloki.map((b) => b.id);

  const polaWgBloku = new Map<string, PageField[]>();
  const wierszeWgBloku = new Map<string, PageRow[]>();
  if (idBlokow.length > 0) {
    const { data: pola, error: bladPol } = await supabase
      .from("page_fields")
      .select("id, block_id, name, type, config, position, is_title")
      .in("block_id", idBlokow)
      .order("position", { ascending: true });
    if (bladPol) return null;
    for (const p of pola ?? []) {
      const lista = polaWgBloku.get(p.block_id) ?? [];
      lista.push({
        id: p.id,
        name: p.name,
        type: p.type as FieldType,
        config: p.config as FieldConfig,
        position: p.position,
        isTitle: p.is_title,
      });
      polaWgBloku.set(p.block_id, lista);
    }

    // Wiersze stronami, bo PostgREST domyślnie tnie wynik do 1000
    for (let od = 0; ; od += ROZMIAR_STRONY) {
      const { data: wiersze, error: bladWierszy } = await supabase
        .from("page_rows")
        .select("id, block_id, values, position, deleted_at")
        .in("block_id", idBlokow)
        .is("deleted_at", null)
        .order("position", { ascending: true })
        .order("id", { ascending: true })
        .range(od, od + ROZMIAR_STRONY - 1);
      if (bladWierszy) return null;
      for (const w of wiersze ?? []) {
        const lista = wierszeWgBloku.get(w.block_id) ?? [];
        lista.push({
          id: w.id,
          values: (w.values ?? {}) as Record<string, unknown>,
          position: w.position,
          deletedAt: w.deleted_at,
        });
        wierszeWgBloku.set(w.block_id, lista);
      }
      if ((wiersze ?? []).length < ROZMIAR_STRONY) break;
    }
  }

  const blocks: LoadedBlock[] = bloki.map((b) => ({
    id: b.id,
    type: b.type as BlockType,
    position: b.position,
    content: (b.content ?? {}) as Record<string, unknown>,
    fields: polaWgBloku.get(b.id) ?? [],
    rows: wierszeWgBloku.get(b.id) ?? [],
  }));

  const timezone = safeTimezone(profilRes.data?.timezone);
  return {
    page: {
      id: strona.id,
      title: strona.title,
      icon: strona.icon,
      favorite: strona.favorite,
      templateKey: SZABLONY.includes(strona.template_key ?? "")
        ? (strona.template_key as TemplateKey)
        : null,
      position: strona.position,
      rowCount: blocks
        .filter((b) => b.type === "table")
        .reduce((n, b) => n + b.rows.length, 0),
      createdAt: strona.created_at ?? "",
    },
    blocks,
    today: todayIso(timezone),
    currency: profilRes.data?.currency || "PLN",
  };
}
