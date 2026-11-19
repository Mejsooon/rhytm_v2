// Lista stron użytkownika (sidebar, /strony) z licznikiem wierszy; przy okazji
// zakłada strony z szablonów wybranych w onboardingu (profiles.pending_pages).
import { cache } from "react";
import type { Json } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import {
  buildTemplateBlocks,
  TEMPLATE_KEYS,
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


// cache(): layout i strona /strony w jednym żądaniu dzielą jedno wywołanie
export const loadPages = cache(async (): Promise<PageSummary[]> => {
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
    const { error: bladTworzenia } = await supabase.rpc("create_page", {
      p_title: szablon.name,
      p_icon: szablon.icon,
      p_template_key: klucz,
      p_blocks: buildTemplateBlocks(klucz, () => crypto.randomUUID()) as unknown as Json,
    });
    if (bladTworzenia) {
      // Nazwa jest już zdjęta z pending_pages, więc wracamy ją tam, żeby następny render spróbował ponownie
      console.error("Nie udało się utworzyć strony z onboardingu", nazwa, bladTworzenia);
      const { data: profil } = await supabase
        .from("profiles")
        .select("pending_pages")
        .eq("user_id", user.id)
        .maybeSingle();
      await supabase
        .from("profiles")
        .update({ pending_pages: [...(profil?.pending_pages ?? []), nazwa] })
        .eq("user_id", user.id);
    }
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
    templateKey: (TEMPLATE_KEYS as readonly string[]).includes(s.template_key ?? "")
      ? (s.template_key as TemplateKey)
      : null,
    position: s.position,
    rowCount: (s.page_blocks ?? []).reduce(
      (suma, b) =>
        suma + (b.page_rows ?? []).reduce((n, r) => n + (r.count ?? 0), 0),
      0,
    ),
  }));
});
