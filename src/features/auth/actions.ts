"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { pathAfterLogin } from "@/lib/auth/next-path";
import { signInSchema } from "@/lib/auth/schemas";
import { verifyTurnstile } from "@/lib/auth/turnstile";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = {
  status: "idle" | "error" | "success";
  message?: string;
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

// Logowanie przez Google: przekierowanie do dostawcy, powrót na /auth/callback
export async function signInWithGoogle(): Promise<never> {
  const naglowki = await headers();
  const host = naglowki.get("x-forwarded-host") ?? naglowki.get("host");
  const proto = naglowki.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${proto}://${host}/auth/callback` },
  });
  if (error || !data.url) {
    redirect("/logowanie?blad=oauth");
  }
  redirect(data.url);
}
