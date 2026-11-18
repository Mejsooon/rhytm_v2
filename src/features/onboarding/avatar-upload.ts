import { createClient } from "@/lib/supabase/client";

const MAKS_BAJTOW = 2 * 1024 * 1024;

// Typ pliku -> rozszerzenie w ścieżce `<uid>/avatar.<ext>` (zgodne z walidacją w actions.ts)
const ROZSZERZENIA: Record<string, "png" | "jpg" | "webp"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// null = plik OK, w przeciwnym razie komunikat dla użytkownika
export function validateAvatarFile(file: File): string | null {
  if (!(file.type in ROZSZERZENIA))
    return "Wybierz zdjęcie PNG, JPG albo WebP.";
  if (file.size > MAKS_BAJTOW) return "Plik jest za duży (maks. 2 MB).";
  return null;
}

// Wgrywa zdjęcie do prywatnego bucketu `avatars` (własny folder), nadpisując poprzednie
export async function uploadAvatar(
  file: File,
  userId: string,
): Promise<{ path: string } | { error: string }> {
  const blad = { error: "Nie udało się wgrać zdjęcia." };
  const ext = ROZSZERZENIA[file.type];
  if (!ext) return blad;
  const path = `${userId}/avatar.${ext}`;
  try {
    const { error } = await createClient()
      .storage.from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (error) return blad;
    return { path };
  } catch {
    return blad;
  }
}
