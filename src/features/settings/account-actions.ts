"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { matchesWord } from "@/components/controls/match-word";
import { isPasswordPwned } from "@/lib/auth/hibp";
import { newPasswordSchema } from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type AccountResult = { ok: true } | { ok: false; message: string };

// Adres zawsze przycinany i zapisywany małymi literami
const adresSchema = z.string().trim().toLowerCase().pipe(z.email());

// Zmiana e-maila: Supabase wysyła link na obecny i na nowy adres (double_confirm_changes), zmiana wchodzi po obu kliknięciach
export async function requestEmailChange(
  email: string,
): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const parsed = adresSchema.safeParse(email);
  if (!parsed.success)
    return { ok: false, message: "To nie wygląda na adres e-mail." };
  if (parsed.data === (user.email ?? "").toLowerCase())
    return { ok: false, message: "To już jest Twój adres." };

  const { error } = await supabase.auth.updateUser({ email: parsed.data });
  if (error) {
    const kod = error.code ?? "";
    if (kod === "email_exists")
      return { ok: false, message: "Ten adres jest już zajęty." };
    if (error.status === 429 || kod.includes("rate_limit"))
      return { ok: false, message: "Za dużo prób. Spróbuj za chwilę." };
    return {
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    };
  }

  revalidatePath("/ustawienia/ogolne");
  return { ok: true };
}

// Zmiana hasła do konta (Ustawienia → Konto i bezpieczeństwo). Haseł nigdy nie logujemy.
export async function changePassword(input: {
  current: string;
  next: string;
  repeat: string;
}): Promise<AccountResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // 1. Konto bez hasła (samo Google) nie ma czego sprawdzić. Hasło ustawione linkiem nie dodaje
  // tożsamości „email”, więc pytamy bazę; stara baza bez funkcji → tożsamości jak dotąd
  const { data: maHaslo, error: bladHasla } =
    await supabase.rpc("my_has_password");
  const zHaslem = bladHasla
    ? (user.identities ?? []).some((t) => t.provider === "email")
    : maHaslo === true;
  if (!zHaslem)
    return {
      ok: false,
      message: "To konto loguje się przez Google. Ustaw hasło linkiem z maila.",
    };

  // 2. Format: obecne wpisane, nowe min. 10 znaków z literami i cyframi, powtórzone, inne niż obecne
  const current = typeof input?.current === "string" ? input.current : "";
  if (!current) return { ok: false, message: "Wpisz obecne hasło." };
  const parsed = newPasswordSchema.safeParse({
    password: input?.next,
    confirm: input?.repeat,
  });
  if (!parsed.success)
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Sprawdź nowe hasło.",
    };
  if (parsed.data.password === current)
    return {
      ok: false,
      message: "Nowe hasło musi różnić się od obecnego.",
    };

  // 3. Hasło z wycieków (HIBP, k-anonimowość)
  if (await isPasswordPwned(parsed.data.password))
    return {
      ok: false,
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    };

  // 4. Obecne hasło sprawdza baza (limit 5 prób / 15 min); stara baza nie ma funkcji (PGRST202)
  const { data: zgodne, error: bladWeryfikacji } = await supabase.rpc(
    "verify_my_password",
    { p_password: current },
  );
  if (bladWeryfikacji) {
    if (bladWeryfikacji.code === "PGRST202")
      return {
        ok: false,
        message: "Zmiana hasła będzie dostępna za chwilę. Spróbuj później.",
      };
    if ((bladWeryfikacji.message ?? "").includes("za_duzo_prob"))
      return {
        ok: false,
        message: "Za dużo nieudanych prób. Spróbuj za 15 minut.",
      };
    return {
      ok: false,
      message: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    };
  }
  if (zgodne !== true)
    return { ok: false, message: "Obecne hasło jest nieprawidłowe." };

  // 5. Nowe hasło + data zmiany (podpis „zmienione DD.MM.RRRR” w Ogólnych)
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
    data: { password_changed_at: new Date().toISOString() },
  });
  if (error)
    return {
      ok: false,
      message: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    };

  // 6. Inne urządzenia tracą sesję, ta zostaje; błąd wylogowania nie może wyglądać jak pełny sukces
  const { error: bladWylogowania } = await supabase.auth.signOut({
    scope: "others",
  });
  revalidatePath("/ustawienia/konto");
  revalidatePath("/ustawienia/ogolne");
  if (bladWylogowania)
    return {
      ok: false,
      message:
        "Hasło zmienione, ale nie udało się wylogować innych urządzeń. Użyj „Wyloguj wszystkie inne”.",
    };
  return { ok: true };
}

// Konto tylko z Google: link do ustawienia hasła (dalej istniejący ekran /nowe-haslo)
export async function sendSetPasswordLink(
  turnstileToken: string | null,
): Promise<
  { ok: true; email: string } | { ok: false; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");
  const email = user.email ?? "";
  if (!email)
    return {
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    };

  // Adres aplikacji: NEXT_PUBLIC_SITE_URL; nagłówkom żądania ufamy tylko poza produkcją (jak w auth/actions.ts)
  let origin = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (!origin && process.env.NODE_ENV === "production")
    return {
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    };
  if (!origin) {
    const naglowki = await headers();
    const host =
      naglowki.get("x-forwarded-host") ??
      naglowki.get("host") ??
      "localhost:3000";
    const protokol =
      naglowki.get("x-forwarded-proto") ??
      (host.startsWith("localhost") ? "http" : "https");
    origin = `${protokol}://${host}`;
  }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/confirm`,
    captchaToken: turnstileToken ?? undefined,
  });
  if (error) {
    if (error.code === "captcha_failed")
      return { ok: false, message: "Potwierdź, że nie jesteś botem" };
    if (error.status === 429 || (error.code ?? "").includes("rate_limit"))
      return { ok: false, message: "Za dużo prób. Spróbuj za chwilę." };
    return {
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    };
  }
  return { ok: true, email };
}

// „Wyloguj wszystkie inne”: kończy wszystkie sesje poza bieżącą
export async function signOutOtherSessions(): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "others" });
  revalidatePath("/ustawienia/konto");
  return { ok: !error };
}

// „Wyloguj” jednej innej sesji: funkcja w bazie usuwa własny wiersz auth.sessions
// (token dostępu tamtej sesji działa jeszcze do wygaśnięcia, ≤ 1 h — decyzja C8)
export async function revokeSession(id: string): Promise<AccountResult> {
  const parsed = z.uuid().safeParse(id);
  if (!parsed.success) return { ok: false, message: "Ta sesja już wygasła." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("revoke_my_session", {
    p_session_id: parsed.data,
  });
  // Każdy błąd (także brak_sesji: JWT bez session_id) → ogólny komunikat, nic nie usunięto
  if (error)
    return {
      ok: false,
      message: "Nie udało się wylogować sesji. Spróbuj ponownie.",
    };
  if (data !== true) return { ok: false, message: "Ta sesja już wygasła." };
  revalidatePath("/ustawienia/konto");
  return { ok: true };
}

// „Usuń konto” (Ogólne): konto oznaczone do usunięcia, trwale usuwa je po 30 dniach pg_cron
// (purge_deleted_accounts). Do tego czasu wystarczy się zalogować i przywrócić konto na /konto-usuniete.
export async function requestAccountDeletion(
  word: string,
): Promise<{ ok: false; message: string }> {
  // Słowo sprawdzamy ponownie na serwerze (wielkość liter i spacje na brzegach bez znaczenia)
  if (typeof word !== "string" || !matchesWord(word, "USUŃ"))
    return { ok: false, message: "Wpisz USUŃ, żeby potwierdzić." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  // Datę i tak nadaje wyzwalacz (now()). Zero zmienionych wierszy albo stara baza bez kolumny = błąd
  const { data: profil, error } = await supabase
    .from("profiles")
    .update({ deletion_requested_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .select("avatar_path")
    .maybeSingle();
  if (error || !profil)
    return {
      ok: false,
      message: "Nie udało się usunąć konta. Spróbuj ponownie.",
    };

  // Dalsze kroki bez sprawdzania błędów: konto jest już oznaczone.
  // Urządzenia push przestają dostawać powiadomienia (tabela może jeszcze nie istnieć — klient bez typów)
  const db = supabase as unknown as SupabaseClient;
  await db.from("push_subscriptions").delete().eq("user_id", user.id);

  // Zdjęcie profilowe usuwamy od razu: SQL w pg_cron nie usunie pliku ze Storage (decyzja C16).
  // Ścieżkę zerujemy tylko po udanym usunięciu pliku — inaczej plik zostałby bez śladu w profilu
  if (profil.avatar_path) {
    const { error: bladPliku } = await supabase.storage
      .from("avatars")
      .remove([profil.avatar_path]);
    if (!bladPliku)
      await supabase
        .from("profiles")
        .update({ avatar_path: null })
        .eq("user_id", user.id);
  }

  // Wylogowanie ze wszystkich urządzeń
  await supabase.auth.signOut({ scope: "global" });
  redirect("/logowanie?konto=usuniete");
}

// „Przywróć konto” (/konto-usuniete): zdejmuje oznaczenie i wraca do aplikacji
export async function restoreAccount(): Promise<{
  ok: false;
  message: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/logowanie");

  const { data, error } = await supabase
    .from("profiles")
    .update({ deletion_requested_at: null })
    .eq("user_id", user.id)
    .select("user_id")
    .maybeSingle();
  if (error || !data)
    return {
      ok: false,
      message: "Nie udało się przywrócić konta. Spróbuj ponownie.",
    };

  revalidatePath("/", "layout");
  redirect("/dzis");
}
