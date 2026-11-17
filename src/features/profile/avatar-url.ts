import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/database";

// Podpisany adres (1 godz.) zdjęcia z prywatnego bucketu `avatars`; brak ścieżki lub błąd → null (inicjały)
export async function getAvatarUrl(
  supabase: SupabaseClient<Database>,
  avatarPath: string | null | undefined,
): Promise<string | null> {
  if (!avatarPath) return null;
  try {
    const { data, error } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 3600);
    if (error || !data) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}
