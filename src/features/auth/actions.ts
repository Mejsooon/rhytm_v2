"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { isPasswordPwned } from "@/lib/auth/hibp";
import { pathAfterLogin } from "@/lib/auth/next-path";
import { signInSchema, signUpSchema } from "@/lib/auth/schemas";
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

export async function signIn(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
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
  const ip = naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const token = formData.get("cf-turnstile-response");
  const botOk = await verifyTurnstile(typeof token === "string" ? token : null, ip);
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

// Adres aplikacji z nagłówków żądania (za proxy: x-forwarded-*)
async function originZNaglowkow(): Promise<string> {
  const naglowki = await headers();
  const host = naglowki.get("x-forwarded-host") ?? naglowki.get("host");
  const proto = naglowki.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
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
export async function signUp(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
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
  const ip = naglowki.get("x-forwarded-for")?.split(",")[0]?.trim() || undefined;
  const token = formData.get("cf-turnstile-response");
  const botOk = await verifyTurnstile(typeof token === "string" ? token : null, ip);
  if (!botOk) {
    return { status: "error", message: "Potwierdź, że nie jesteś botem" };
  }

  // 3. Hasło nie może być w wyciekach (serwer sprawdza zawsze, niezależnie od reguły na żywo)
  if (await isPasswordPwned(parsed.data.password)) {
    return { status: "error", message: "To hasło wystąpiło w wyciekach danych. Wybierz inne." };
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
  const juzIstnieje = error?.code === "user_already_exists" || /already registered/i.test(error?.message ?? "");
  if (error && !juzIstnieje) {
    return { status: "error", message: "Nie udało się założyć konta. Spróbuj ponownie." };
  }
  return { status: "success", email: parsed.data.email };
}

// Reguła „nie ma go w bazie wycieków” na żywo (klient woła z debounce 400 ms)
export async function checkPasswordLeak(password: string): Promise<boolean> {
  return isPasswordPwned(password);
}

// Ponowne wysłanie linku potwierdzającego. Zawsze „sukces” — nie zdradzamy stanu konta.
export async function resendConfirmation(email: string): Promise<AuthFormState> {
  const origin = await originZNaglowkow();
  const supabase = await createClient();
  await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  return { status: "success", email };
}
