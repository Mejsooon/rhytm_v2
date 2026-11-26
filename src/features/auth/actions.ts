"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

import { isPasswordPwned } from "@/lib/auth/hibp";
import { pathAfterLogin } from "@/lib/auth/next-path";
import { RECOVERY_COOKIE, znacznikResetuPasuje } from "@/lib/auth/recovery";
import {
  newPasswordSchema,
  resetRequestSchema,
  signInSchema,
  signUpSchema,
} from "@/lib/auth/schemas";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
  // E-mail, na który wysłano link (stan success rejestracji)
  email?: string;
  fieldErrors?: Partial<Record<string, string>>;
};

// Jeden komunikat dla każdego błędu logowania — nie zdradzamy, czy konto istnieje
const BLAD_LOGOWANIA = "Nieprawidłowy e-mail lub hasło";

// Turnstile sprawdza Supabase (Auth → Attack Protection), więc nie da się go ominąć, wołając API bezpośrednio.
// Token dodaje widżet jako ukryte pole cf-turnstile-response.
const BLAD_BOTA: AuthFormState = { status: "error", message: "Potwierdź, że nie jesteś botem" };

function tokenZFormularza(formData: FormData): string | undefined {
  const token = formData.get("cf-turnstile-response");
  return typeof token === "string" ? token : undefined;
}

export async function signIn(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // 1. Walidacja formatu (zod)
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { status: "error", message: BLAD_LOGOWANIA };
  }

  // 2. Logowanie hasłem
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    ...parsed.data,
    options: { captchaToken: tokenZFormularza(formData) },
  });
  if (error?.code === "captcha_failed") return BLAD_BOTA;
  if (error || !data.user) {
    return { status: "error", message: BLAD_LOGOWANIA };
  }

  // 3. Profil decyduje: ekran przywracania (konto do usunięcia), aplikacja albo onboarding
  const { data: profil, error: bladProfilu } = await supabase
    .from("profiles")
    .select("onboarded_at, deletion_requested_at")
    .eq("user_id", data.user.id)
    .maybeSingle();
  // Stara baza bez kolumny deletion_requested_at (42703): sam onboarding
  let profilDoCelu: Parameters<typeof pathAfterLogin>[0] = profil;
  if (bladProfilu?.code === "42703") {
    const { data: stary } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("user_id", data.user.id)
      .maybeSingle();
    profilDoCelu = stary;
  }

  redirect(pathAfterLogin(profilDoCelu));
}

// Adres aplikacji do linków zwrotnych. Źródłem jest NEXT_PUBLIC_SITE_URL (nagłówek Host może podszyć atakujący).
// Nagłówki są tylko zapasem w dev/CI, gdy zmienna nie jest ustawiona; w produkcji jej brak to błąd konfiguracji.
async function originZNaglowkow(): Promise<string> {
  const zKonfiguracji = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(
    /\/+$/,
    "",
  );
  if (zKonfiguracji) return zKonfiguracji;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Brak NEXT_PUBLIC_SITE_URL — ustaw adres aplikacji w zmiennych środowiskowych",
    );
  }
  const naglowki = await headers();
  const host =
    naglowki.get("x-forwarded-host") ??
    naglowki.get("host") ??
    "localhost:3000";
  const proto =
    naglowki.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Logowanie przez Google: przekierowanie do dostawcy, powrót na /auth/callback
export async function signInWithGoogle(): Promise<never> {
  const origin = await originZNaglowkow();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback` },
  });
  if (error || !data.url) {
    redirect("/logowanie?blad=oauth");
  }
  redirect(data.url);
}

// Rejestracja: zod → HIBP → Supabase (tam kontrola Turnstile).
// Sukces i „użytkownik już istnieje” dają TEN SAM stan, żeby nie zdradzać, czy e-mail ma konto.
export async function signUp(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // 1. Walidacja (zod); błędy pól zwracamy do formularza
  const parsed = signUpSchema.safeParse({
    displayName: formData.get("displayName"),
    email: formData.get("email"),
    password: formData.get("password"),
    tos: formData.get("tos"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const pole = String(issue.path[0]);
      fieldErrors[pole] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  // 2. Hasło nie może być w wyciekach (serwer sprawdza zawsze, niezależnie od reguły na żywo)
  if (await isPasswordPwned(parsed.data.password)) {
    return {
      status: "error",
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    };
  }

  // 3. Konto w Supabase; link potwierdzający wraca na /auth/confirm
  const origin = await originZNaglowkow();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
      captchaToken: tokenZFormularza(formData),
    },
  });
  if (error?.code === "captcha_failed") return BLAD_BOTA;
  const juzIstnieje =
    error?.code === "user_already_exists" ||
    /already registered/i.test(error?.message ?? "");
  if (error && !juzIstnieje) {
    return {
      status: "error",
      message: "Nie udało się założyć konta. Spróbuj ponownie.",
    };
  }
  return { status: "success", email: parsed.data.email };
}

// Reguła „nie ma go w bazie wycieków” na żywo (klient woła z debounce 400 ms)
export async function checkPasswordLeak(password: string): Promise<boolean> {
  return isPasswordPwned(password);
}

// Wspólna kontrola e-maila przy ponownym wysłaniu linku. Zwraca błąd do pokazania albo znormalizowany e-mail.
function sprawdzEmail(email: string): { blad: AuthFormState } | { email: string } {
  const parsed = resetRequestSchema.safeParse({ email });
  if (!parsed.success) {
    return {
      blad: {
        status: "error",
        fieldErrors: { email: "Podaj poprawny e-mail" },
      },
    };
  }
  return { email: parsed.data.email };
}

// Ponowne wysłanie linku potwierdzającego. Poza błędem captchy zawsze „sukces” — nie zdradzamy stanu konta.
export async function resendConfirmation(
  email: string,
  turnstileToken: string | null,
): Promise<AuthFormState> {
  const kontrola = sprawdzEmail(email);
  if ("blad" in kontrola) return kontrola.blad;

  const origin = await originZNaglowkow();
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: kontrola.email,
    options: {
      emailRedirectTo: `${origin}/auth/confirm`,
      captchaToken: turnstileToken ?? undefined,
    },
  });
  if (error?.code === "captcha_failed") return BLAD_BOTA;
  return { status: "success", email: kontrola.email };
}

// Prośba o reset hasła: zod → Supabase. Poza błędem captchy zawsze ten sam sukces, niezależnie od tego, czy konto istnieje.
export async function requestPasswordReset(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = resetRequestSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return {
      status: "error",
      fieldErrors: {
        email: parsed.error.issues[0]?.message ?? "Podaj poprawny e-mail",
      },
    };
  }

  // Błąd Supabase (np. brak konta, limit) celowo ignorujemy — odpowiedź dla użytkownika jest zawsze taka sama
  const origin = await originZNaglowkow();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm`,
    captchaToken: tokenZFormularza(formData),
  });
  if (error?.code === "captcha_failed") return BLAD_BOTA;
  return { status: "success", email: parsed.data.email };
}

// Nowe hasło po kliknięciu linku z maila. Wymaga sesji ORAZ podpisanego ciasteczka rhytm_recovery
// (ustawia je tylko /auth/confirm po udanym recovery; HMAC, ten sam użytkownik, najwyżej 15 minut) —
// samo bycie zalogowanym nie pozwala zmienić hasła bez starego.
// Po zmianie wylogowujemy pozostałe urządzenia, a bieżące przechodzi do aplikacji.
export async function updatePassword(
  _prev: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  // Sesję i znacznik sprawdzamy przed jakimkolwiek zapytaniem do HIBP
  const ciasteczka = await cookies();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (
    !user ||
    !znacznikResetuPasuje(ciasteczka.get(RECOVERY_COOKIE)?.value, user.id)
  ) {
    return { status: "error", message: "Link wygasł. Poproś o nowy." };
  }

  const parsed = newPasswordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const pole = String(issue.path[0]);
      fieldErrors[pole] ??= issue.message;
    }
    return { status: "error", fieldErrors };
  }

  if (await isPasswordPwned(parsed.data.password)) {
    return {
      status: "error",
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) {
    return {
      status: "error",
      message: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    };
  }
  await supabase.auth.signOut({ scope: "others" });
  // Znacznik jest jednorazowy
  ciasteczka.delete(RECOVERY_COOKIE);

  redirect("/dzis");
}

// Ponowne wysłanie linku (potwierdzenie konta albo reset hasła). Poza błędem e-maila i captchy zawsze „sukces”.
export async function resendLink(
  type: "signup" | "recovery",
  email: string,
  turnstileToken: string | null,
): Promise<AuthFormState> {
  if (type === "signup") {
    return resendConfirmation(email, turnstileToken);
  }
  const kontrola = sprawdzEmail(email);
  if ("blad" in kontrola) return kontrola.blad;

  const origin = await originZNaglowkow();
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(kontrola.email, {
    redirectTo: `${origin}/auth/confirm`,
    captchaToken: turnstileToken ?? undefined,
  });
  if (error?.code === "captcha_failed") return BLAD_BOTA;
  return { status: "success", email: kontrola.email };
}

// Wylogowanie: kończy sesję Supabase i wraca na ekran logowania.
// SignOutForm dokłada endpoint push tej przeglądarki (pole push_endpoint) — usuwamy jego wiersz, zanim sesja
// zniknie, żeby na wspólnym urządzeniu nie przychodziły powiadomienia wylogowanego konta. Błąd nie blokuje wylogowania.
export async function signOut(formData?: FormData): Promise<never> {
  const supabase = await createClient();
  const endpoint = formData instanceof FormData ? formData.get("push_endpoint") : null;
  if (typeof endpoint === "string" && endpoint.length > 0 && endpoint.length <= 1000) {
    try {
      await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
    } catch {
      // stara baza albo błąd sieci — wylogowujemy mimo to
    }
  }
  await supabase.auth.signOut();
  redirect("/logowanie");
}
