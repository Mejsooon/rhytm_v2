import { expect, test } from "@playwright/test";

import {
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./helpers/konto";

// Strony prawne są publiczne — nie potrzebują sesji ani Supabase
test("/regulamin i /prywatnosc są dostępne bez logowania", async ({ page }) => {
  await page.goto("/regulamin");
  await expect(page).toHaveURL(/\/regulamin$/);
  await expect(page.getByRole("heading", { name: "Regulamin" })).toBeVisible();

  await page.goto("/prywatnosc");
  await expect(page).toHaveURL(/\/prywatnosc$/);
  await expect(
    page.getByRole("heading", { name: "Polityka prywatności" }),
  ).toBeVisible();
});

// Regresja: strony z Suspense nie mogą mieć w HTML drugiej kopii formularza (fallback = ta sama treść)
test("ekrany konta mają dokładnie jeden formularz", async ({ page }) => {
  await page.goto("/logowanie");
  await expect(page.locator('input[name="email"]')).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Zaloguj się", exact: true }),
  ).toHaveCount(1);

  await page.goto("/link-wygasl");
  await expect(page.locator('input[name="email"]')).toHaveCount(1);
  await expect(
    page.getByRole("button", { name: "Wyślij nowy link" }),
  ).toHaveCount(1);
});

test.describe("powłoka aplikacji", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("sidebar zostaje przyklejony do góry przy przewinięciu długiej treści (web)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "sidebar istnieje tylko na webie");
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    // Powłoka dociąga się strumieniem (Suspense) — dopiero po treści modułu <main> jest ostateczny.
    // Wcześniejszy wstrzyknięty element zniknąłby przy podmianie, a strona nie dałaby się przewinąć.
    const tresc = page.getByText("Nie masz jeszcze bloków na dziś.");
    await expect(tresc).toBeVisible();
    const sidebar = page.getByRole("navigation", { name: "Główna nawigacja" });
    await expect(sidebar).toBeVisible();

    // Wydłużamy treść, żeby przewijało się okno (sidebar: sticky top-0 h-dvh, przewija się tylko treść)
    await page.evaluate(() => {
      const wypelniacz = document.createElement("div");
      wypelniacz.style.height = "3000px";
      document.querySelector("main")!.appendChild(wypelniacz);
    });
    const trescPrzed = (await tresc.boundingBox())!.y;
    await page.evaluate(() => window.scrollBy(0, 300));
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(0);

    // Treść się przesunęła, a sidebar został na górze, na pełną wysokość okna
    expect((await tresc.boundingBox())!.y).toBeLessThan(trescPrzed);
    const ramka = (await sidebar.boundingBox())!;
    expect(ramka.y).toBe(0);
    expect(ramka.height).toBe(900);
  });

  test("pasek boczny chowa się przyciskiem, zostaje schowany po odświeżeniu i wraca przez Ctrl+\\ (web)", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "pasek boczny chowa się tylko na webie");
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    const nawigacja = page.getByRole("navigation", { name: "Główna nawigacja" });
    await expect(nawigacja).toBeVisible();

    await page.getByRole("button", { name: "Schowaj pasek boczny" }).click();
    await expect(nawigacja).toBeHidden();
    await expect(
      page.getByRole("button", { name: "Pokaż pasek boczny" }),
    ).toBeVisible();

    // Stan siedzi w ciasteczku czytanym na serwerze — po odświeżeniu pasek dalej schowany
    await page.reload();
    await expect(page.getByText("Nie masz jeszcze bloków na dziś.")).toBeVisible();
    await expect(nawigacja).toBeHidden();

    await page.keyboard.press("Control+\\");
    await expect(nawigacja).toBeVisible();
  });

  test("dolny pasek jest przyklejony do dołu i wskazuje aktywny moduł (telefon)", async ({
    page,
  }, info) => {
    test.skip(
      info.project.name !== "mobile",
      "dolny pasek istnieje tylko na telefonie",
    );
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    const pasek = page.getByRole("navigation", { name: "Moduły" });
    await expect(pasek).toBeVisible();
    await expect(pasek.getByRole("link", { name: "Dziś" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    const ramka = (await pasek.boundingBox())!;
    expect(Math.round(ramka.y + ramka.height)).toBe(844);
  });
});
