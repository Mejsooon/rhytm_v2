// Lista stron użytkownika (sidebar, /strony) z licznikiem wierszy; przy okazji
// zakłada strony z szablonów wybranych w onboardingu (profiles.pending_pages).
import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import {
  buildTemplateBlocks,
  PENDING_TO_TEMPLATE,
  TEMPLATES,
  type TemplateKey,
} from "./templates";

export type PageSummary = {
  id: string;
  title: string;
  icon: string;
  favorite: boolean;
  templateKey: TemplateKey | null;
  position: number;
  // Niewykasowane wiersze w niewykasowanych tabelach strony (0 bez tabel)
  rowCount: number;
};

const SZABLONY: string[] = ["empty", "books", "projects", "websites"];

export async function loadPages(): Promise<PageSummary[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // RPC atomowo zdejmuje nazwy z pending_pages, więc dwa równoległe rendery nie zdublują stron
  const { data: zajete } = await supabase.rpc("claim_pending_pages", {
    p_available: Object.keys(PENDING_TO_TEMPLATE),
  });
  for (const nazwa of zajete ?? []) {
    const klucz = PENDING_TO_TEMPLATE[nazwa];
    if (!klucz) continue;
    const szablon = TEMPLATES[klucz];
    await supabase.rpc("create_page", {
      p_title: szablon.name,
      p_icon: szablon.icon,
      p_template_key: klucz,
      p_blocks: buildTemplateBlocks(klucz, () => crypto.randomUUID()) as unknown as Json,
    });
  }

  // Jedno zapytanie: strony z licznikiem wierszy (filtry na osadzonych zasobach tną usunięte bloki i wiersze)
  const { data, error } = await supabase
    .from("pages")
    .select("id, title, icon, favorite, template_key, position, page_blocks(page_rows(count))")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .is("page_blocks.deleted_at", null)
    .is("page_blocks.page_rows.deleted_at", null)
    .order("position", { ascending: true });
  if (error || !data) return [];

  return data.map((s) => ({
    id: s.id,
    title: s.title,
    icon: s.icon,
    favorite: s.favorite,
    templateKey: SZABLONY.includes(s.template_key ?? "")
      ? (s.template_key as TemplateKey)
      : null,
    position: s.position,
    rowCount: (s.page_blocks ?? []).reduce(
      (suma, b) =>
        suma + (b.page_rows ?? []).reduce((n, r) => n + (r.count ?? 0), 0),
      0,
    ),
  }));
}
