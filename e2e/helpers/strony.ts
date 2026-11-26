import { expect, type Page } from "@playwright/test";

import {
  adminClient,
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./konto";

// Konto po onboardingu, zalogowane, z pustą listą stron do utworzenia (pending_pages = []),
// więc sidebar jest deterministyczny — loadPages nie zakłada stron z onboardingu.
export async function zalozKontoStron(
  page: Page,
  projekt: string,
): Promise<string> {
  const email = uniqueEmail(projekt);
  const haslo = randomPassword();
  const userId = await createConfirmedUser(email, haslo);
  const { error } = await adminClient()
    .from("profiles")
    .update({ pending_pages: [] })
    .eq("user_id", userId);
  if (error)
    throw new Error(`Nie udało się wyczyścić pending_pages: ${error.message}`);
  await logInViaForm(page, email, haslo);
  await expect(page).toHaveURL(/\/dzis$/);
  return userId;
}

// Strona z szablonu Książki założona przez /strony/nowa (karta „Książki” → „Utwórz stronę”)
export async function utworzBooks(page: Page): Promise<void> {
  await page.goto("/strony/nowa");
  // Web (S2NewPage): karty szablonów to radio; telefon (CMNewPage): przyciski z aria-pressed
  await page
    .getByRole("radio", { name: /^Książki/ })
    .or(page.getByRole("button", { name: /^Książki/ }))
    .click();
  await page.getByRole("button", { name: /^Utwórz( stronę)?$/ }).click();
  await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
  // Tytuł jest polem „Nazwa strony” na webie i telefonie (h1 jest tylko w nagłówku webowym)
  await expect(page.getByRole("textbox", { name: "Nazwa strony" })).toHaveValue(
    "Książki",
  );
}

// Strona z szablonu Subscriptions założona przez /strony/nowa (karta „Subskrypcje” → „Utwórz stronę”)
export async function utworzSubscriptions(page: Page): Promise<void> {
  await page.goto("/strony/nowa");
  // Web (S2NewPage): karty szablonów to radio; telefon (CMNewPage): przyciski z aria-pressed
  await page
    .getByRole("radio", { name: /^Subskrypcje/ })
    .or(page.getByRole("button", { name: /^Subskrypcje/ }))
    .click();
  await page.getByRole("button", { name: /^Utwórz( stronę)?$/ }).click();
  await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
  // Web: pole „Nazwa strony”. Telefon (CMSubs): własny ekran z nagłówkiem h1, bez pola nazwy
  const nazwa = page.getByRole("textbox", { name: "Nazwa strony" });
  await expect(
    nazwa.or(page.getByRole("heading", { name: "Subskrypcje", level: 1 })).first(),
  ).toBeVisible();
  if (await nazwa.isVisible()) await expect(nazwa).toHaveValue("Subskrypcje");
}

// Pusta strona edytora bloków (bez szablonu i bez bloków), jak dawne „Nowa strona” z paska.
// Na webie pasek prowadzi teraz do wyboru szablonu, więc pustą stronę zakładamy przez API administratora.
export async function zasiejPustaStrone(
  userId: string,
  tytul = "",
): Promise<string> {
  const { data, error } = await adminClient()
    .from("pages")
    .insert({ user_id: userId, title: tytul, icon: "" })
    .select("id")
    .single();
  if (error || !data)
    throw new Error(`Nie udało się zasiać pustej strony: ${error?.message}`);
  return data.id as string;
}
