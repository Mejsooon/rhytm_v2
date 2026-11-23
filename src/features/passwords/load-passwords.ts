// Dane modułu Hasła: strona systemowa użytkownika (tworzona przy pierwszym wejściu) z blokiem tabeli.
import { loadPage, type LoadedPage } from "@/features/pages/load-page";
import { createClient } from "@/lib/supabase/server";

// null, gdy nie ma sesji albo nie udało się utworzyć lub wczytać strony
export async function loadPasswordsModule(): Promise<LoadedPage | null> {
  const supabase = await createClient();
  // Funkcja zwraca id strony systemowej (tworzy ją i jej kolumny, jeśli jeszcze nie istnieje)
  const { data: id, error } = await supabase.rpc("ensure_passwords_page");
  if (error || !id) return null;
  return loadPage(id);
}
