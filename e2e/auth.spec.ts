import { expect, test, type Page } from "@playwright/test";

import { countMailsFor, latestLinkFor } from "./helpers/mailpit";
import { createConfirmedUser, logInViaForm, randomPassword, uniqueEmail, waitForTurnstile } from "./helpers/konto";

// Wszystkie testy konta potrzebują lokalnego Supabase (supabase start) i Mailpit — w CI ustawia to E2E_SUPABASE=1
test.describe("konto", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  // Po zalogowaniu widać nawigację właściwą dla szerokości: sidebar (web) albo dolny pasek (telefon)
  async function oczekujNawigacji(page: Page, projekt: string) {
    if (projekt === "web") {
      await expect(page.getByRole("navigation", { name: "Główna nawigacja" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Moduły" })).toBeHidden();
    } else {
      await expect(page.getByRole("navigation", { name: "Moduły" })).toBeVisible();
      await expect(page.getByRole("navigation", { name: "Główna nawigacja" })).toBeHidden();
    }
  }

  test("rejestracja → mail → potwierdzenie → onboarding → /dzis", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();

    await page.goto("/rejestracja");
    await page.locator('input[name="displayName"]').fill("Mejson E2E");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(haslo);
    await page.getByRole("checkbox").click();
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Utwórz konto" }).click();

    await expect(page.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeVisible();

    // Link z Mailpit prowadzi na /auth/confirm → „E-mail potwierdzony”
    await page.goto(await latestLinkFor(email));
    await expect(page.getByRole("heading", { name: "E-mail potwierdzony" })).toBeVisible();

    // Dalej → tymczasowy onboarding → Dalej → /dzis
    await page.getByRole("link", { name: "Dalej" }).click();
    await expect(page).toHaveURL(/\/onboarding$/);
    await page.getByRole("button", { name: "Dalej" }).click();
    await expect(page).toHaveURL(/\/dzis$/);
    await oczekujNawigacji(page, info.project.name);
  });

  test("logowanie z e-mailem ze spacjami i wielkimi literami", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);

    await logInViaForm(page, ` ${email} `, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
    await oczekujNawigacji(page, info.project.name);
  });

  test("wylogowanie przez dymek konta, potem ponowne logowanie", async ({ page }, info) => {
    // Dymek konta jest tylko w sidebarze; na telefonie wylogowanie powstanie z Ustawieniami
    test.skip(info.project.name !== "web", "dymek konta istnieje tylko na webie");
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);

    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.getByRole("navigation", { name: "Główna nawigacja" }).getByRole("button", { name: /Mejson E2E/ }).click();
    await page.getByRole("button", { name: "Wyloguj się" }).click();
    await expect(page).toHaveURL(/\/logowanie$/);

    // Po wylogowaniu /dzis odsyła z powrotem do logowania
    await page.goto("/dzis");
    await expect(page).toHaveURL(/\/logowanie$/);

    await logInViaForm(page, ` ${email} `, haslo);
    await expect(page).toHaveURL(/\/dzis$/);
  });

  test("złe hasło → „Nieprawidłowy e-mail lub hasło”", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    await createConfirmedUser(email, randomPassword());

    await logInViaForm(page, email, "to-nie-jest-haslo-123");
    await expect(page.getByText("Nieprawidłowy e-mail lub hasło")).toBeVisible();
    await expect(page).toHaveURL(/\/logowanie$/);
  });

  test("reset hasła: e-mail → link → nowe hasło → /dzis", async ({ page, browser, baseURL }, info) => {
    const email = uniqueEmail(info.project.name);
    await createConfirmedUser(email, randomPassword());

    await page.goto("/reset-hasla");
    await page.locator('input[name="email"]').fill(email);
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Wyślij link" }).click();
    await expect(page.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeVisible();

    // Link resetu ustawia podpisane ciasteczko rhytm_recovery i prowadzi na /nowe-haslo
    await page.goto(await latestLinkFor(email));
    await expect(page).toHaveURL(/\/nowe-haslo$/);

    const noweHaslo = randomPassword();
    await page.locator('input[name="password"]').fill(noweHaslo);
    await page.locator('input[name="confirm"]').fill(noweHaslo);
    await page.getByRole("button", { name: "Zapisz i zaloguj się" }).click();
    await expect(page).toHaveURL(/\/dzis$/);

    // Nowe hasło działa przy kolejnym logowaniu (czysty kontekst = bez sesji)
    const kontekst = await browser.newContext({ baseURL, viewport: page.viewportSize(), isMobile: info.project.use.isMobile, hasTouch: info.project.use.hasTouch });
    const druga = await kontekst.newPage();
    await logInViaForm(druga, email, noweHaslo);
    await expect(druga).toHaveURL(/\/dzis$/);
    // Zwykła sesja (logowanie hasłem, bez linku resetu) nie pozwala zmienić hasła bez starego
    await druga.goto("/nowe-haslo");
    await expect(druga.getByRole("heading", { name: "Link wygasł" })).toBeVisible();
    await kontekst.close();
  });

  test("drugi raz ten sam link → „Link wygasł” → „Wyślij nowy link”", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();

    // Konto przez formularz, żeby dostać prawdziwy mail potwierdzający
    await page.goto("/rejestracja");
    await page.locator('input[name="displayName"]').fill("Mejson E2E");
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="password"]').fill(haslo);
    await page.getByRole("checkbox").click();
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Utwórz konto" }).click();
    await expect(page.getByRole("heading", { name: "Sprawdź skrzynkę" })).toBeVisible();

    const link = await latestLinkFor(email);
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "E-mail potwierdzony" })).toBeVisible();

    // Link jest jednorazowy: drugie użycie kończy się ekranem „Link wygasł”
    await page.goto(link);
    await expect(page.getByRole("heading", { name: "Link wygasł" })).toBeVisible();
    await page.locator('input[name="email"]').fill(email);
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Wyślij nowy link" }).click();
    await expect(page.getByText("Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.")).toBeVisible();
  });

  test("„Wyślij nowy link” przy wygasłym linku resetu wysyła nowy mail", async ({ page }, info) => {
    // Dla potwierdzonego konta ponowne wysłanie linku potwierdzającego nic nie wysyła (celowo), więc
    // wysłanie nowego maila sprawdzamy na linku resetu hasła.
    const email = uniqueEmail(info.project.name);
    await createConfirmedUser(email, randomPassword());
    const przed = await countMailsFor(email.toLowerCase());

    await page.goto("/link-wygasl?type=recovery");
    await page.locator('input[name="email"]').fill(email);
    await waitForTurnstile(page);
    await page.getByRole("button", { name: "Wyślij nowy link" }).click();
    await expect(page.getByText("Jeśli konto z tym adresem istnieje, wysłaliśmy nowy link.")).toBeVisible();

    const link = await latestLinkFor(email, przed + 1);
    expect(link).toContain("/auth/confirm");
    expect(link).toContain("type=recovery");
  });

  test("/xyz po zalogowaniu → „Tej strony nie ma”", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);

    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/xyz");
    await expect(page.getByRole("heading", { name: "Tej strony nie ma" })).toBeVisible();
    await oczekujNawigacji(page, info.project.name);
  });
});
