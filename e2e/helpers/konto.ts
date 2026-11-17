import { randomBytes } from "node:crypto";

import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";

// Unikalny adres na każdy test (wielkie litery i plus — jak w Review Focus 4). Maile w Mailpit szukamy po małych literach.
export function uniqueEmail(projekt: string): string {
  return `Mejson+e2e-${projekt}-${randomBytes(4).toString("hex")}@Example.com`;
}

// Długie, losowe hasło: musi przejść regułę „nie ma go w Have I Been Pwned” (prawdziwe zapytanie w CI)
export function randomPassword(): string {
  return `Rhytm-${randomBytes(12).toString("hex")}-7`;
}

// Czeka, aż Turnstile (klucz testowy) wstawi token do ukrytego pola — bez niego serwer odrzuci formularz
export async function waitForTurnstile(page: Page): Promise<void> {
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Array.from(document.querySelectorAll<HTMLInputElement>('input[name="cf-turnstile-response"]')).some((i) => i.value.length > 0),
        ),
      { message: "Turnstile nie wystawił tokenu", timeout: 20_000 },
    )
    .toBe(true);
}

// Konto z potwierdzonym e-mailem założone przez API administratora (szybciej niż przez formularz).
// `onboarded` = true ustawia profil jak po onboardingu, więc od razu działa /dzis.
export async function createConfirmedUser(email: string, password: string, onboarded = true): Promise<void> {
  await createUser(email, password, onboarded, false);
}

// Konto przed zakończeniem onboardingu, ale z zapisanymi krokami 1–6 (onboarding_step = 7) — do zrzutów ekranów
export async function createUserAtOnboardingEnd(email: string, password: string): Promise<void> {
  await createUser(email, password, false, true);
}

async function createUser(email: string, password: string, onboarded: boolean, allSteps: boolean): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const klucz = process.env.SUPABASE_SECRET_KEY;
  if (!url || !klucz) throw new Error("Brak NEXT_PUBLIC_SUPABASE_URL lub SUPABASE_SECRET_KEY w środowisku testów");

  const admin = createClient(url, klucz, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await admin.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
    user_metadata: { display_name: "Mejson E2E" },
  });
  if (error || !data.user) throw new Error(`Nie udało się założyć konta testowego: ${error?.message}`);

  if (allSteps) {
    const { error: blad } = await admin
      .from("profiles")
      .update({
        display_name: "Mejson",
        timezone: "Europe/Warsaw",
        week_start: "mon",
        clock: "24",
        roles: ["student", "sport"],
        study_field: "Informatyka",
        goals: ["sport", "subs"],
        weekly_km_goal: 30,
        sleep_goal_min: 480,
        referral_source: "friend",
        pending_pages: ["Subscriptions"],
        onboarding_step: 7,
      })
      .eq("user_id", data.user.id);
    if (blad) throw new Error(`Nie udało się ustawić profilu onboardingu: ${blad.message}`);
    const { error: bladPowiadomien } = await admin.from("notification_settings").upsert(
      { user_id: data.user.id, push_enabled: false, before_block_min: 10, renewals_enabled: true, weekly_summary: true, habits_enabled: false },
      { onConflict: "user_id" },
    );
    if (bladPowiadomien) throw new Error(`Nie udało się ustawić powiadomień: ${bladPowiadomien.message}`);
  }

  if (onboarded) {
    // Wiersz profilu tworzy trigger po rejestracji
    const { error: blad } = await admin.from("profiles").update({ onboarded_at: new Date().toISOString() }).eq("user_id", data.user.id);
    if (blad) throw new Error(`Nie udało się oznaczyć onboardingu: ${blad.message}`);
  }
}

// Logowanie przez formularz; zwraca po wysłaniu (test sam sprawdza, dokąd to prowadzi)
export async function logInViaForm(page: Page, email: string, password: string): Promise<void> {
  await page.goto("/logowanie");
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await waitForTurnstile(page);
  await page.getByRole("button", { name: "Zaloguj się", exact: true }).click();
}
