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
import { verifyTurnstile } from "@/lib/auth/turnstile";
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

  // 2. Turnstile — token dodaje widżet jako ukryte pole cf-turnstile-response
  const naglowki = await headers();
  const ip =
    naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const token = formData.get("cf-turnstile-response");
  const botOk = await verifyTurnstile(
    typeof token === "string" ? token : null,
    ip,
  );
  if (!botOk) {
    return { status: "error", message: "Potwierdź, że nie jesteś botem" };
  }

  // 3. Logowanie hasłem
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) {
    return { status: "error", message: BLAD_LOGOWANIA };
  }

  // 4. Profil decyduje, czy idziemy do aplikacji, czy do onboardingu
  const { data: profil } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("user_id", data.user.id)
    .maybeSingle();

  redirect(pathAfterLogin(profil));
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

// Rejestracja: zod → Turnstile → HIBP → Supabase.
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

  // 2. Turnstile
  const naglowki = await headers();
  const ip =
    naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const token = formData.get("cf-turnstile-response");
  const botOk = await verifyTurnstile(
    typeof token === "string" ? token : null,
    ip,
  );
  if (!botOk) {
    return { status: "error", message: "Potwierdź, że nie jesteś botem" };
  }

  // 3. Hasło nie może być w wyciekach (serwer sprawdza zawsze, niezależnie od reguły na żywo)
  if (await isPasswordPwned(parsed.data.password)) {
    return {
      status: "error",
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    };
  }

  // 4. Konto w Supabase; link potwierdzający wraca na /auth/confirm
  const origin = await originZNaglowkow();
  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: `${origin}/auth/confirm`,
    },
  });
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

// Wspólna kontrola ponownego wysłania linku: e-mail (zod) i Turnstile. Publiczna akcja bez nich pozwalałaby zalewać skrzynki.
// Zwraca błąd do pokazania albo znormalizowany e-mail.
async function sprawdzPonowneWyslanie(
  email: string,
  turnstileToken: string | null,
): Promise<{ blad: AuthFormState } | { email: string }> {
  const parsed = resetRequestSchema.safeParse({ email });
  if (!parsed.success) {
    return {
      blad: {
        status: "error",
        fieldErrors: { email: "Podaj poprawny e-mail" },
      },
    };
  }
  const naglowki = await headers();
  const ip =
    naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  if (!(await verifyTurnstile(turnstileToken, ip))) {
    return {
      blad: { status: "error", message: "Potwierdź, że nie jesteś botem" },
    };
  }
  return { email: parsed.data.email };
}

// Ponowne wysłanie linku potwierdzającego. Po przejściu kontroli zawsze „sukces” — nie zdradzamy stanu konta.
export async function resendConfirmation(
  email: string,
  turnstileToken: string | null,
): Promise<AuthFormState> {
  const kontrola = await sprawdzPonowneWyslanie(email, turnstileToken);
  if ("blad" in kontrola) return kontrola.blad;

  const origin = await originZNaglowkow();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: kontrola.email,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  return { status: "success", email: kontrola.email };
}

// Prośba o reset hasła: zod → Turnstile → Supabase. Zawsze ten sam sukces, niezależnie od tego, czy konto istnieje.
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

  const naglowki = await headers();
  const ip =
    naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const token = formData.get("cf-turnstile-response");
  const botOk = await verifyTurnstile(
    typeof token === "string" ? token : null,
    ip,
  );
  if (!botOk) {
    return { status: "error", message: "Potwierdź, że nie jesteś botem" };
  }

  // Błąd Supabase (np. brak konta, limit) celowo ignorujemy — odpowiedź dla użytkownika jest zawsze taka sama
  const origin = await originZNaglowkow();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/confirm`,
  });
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

// Ponowne wysłanie linku (potwierdzenie konta albo reset hasła). Kontrola e-maila i Turnstile, potem zawsze „sukces”.
export async function resendLink(
  type: "signup" | "recovery",
  email: string,
  turnstileToken: string | null,
): Promise<AuthFormState> {
  if (type === "signup") {
    return resendConfirmation(email, turnstileToken);
  }
  const kontrola = await sprawdzPonowneWyslanie(email, turnstileToken);
  if ("blad" in kontrola) return kontrola.blad;

  const origin = await originZNaglowkow();
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(kontrola.email, {
    redirectTo: `${origin}/auth/confirm`,
  });
  return { status: "success", email: kontrola.email };
}

// Wylogowanie: kończy sesję Supabase i wraca na ekran logowania
export async function signOut(): Promise<never> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/logowanie");
}
