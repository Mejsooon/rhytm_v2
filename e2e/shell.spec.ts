import { expect, test } from "@playwright/test";

import { createConfirmedUser, logInViaForm, randomPassword, uniqueEmail } from "./helpers/konto";

// Strony prawne są publiczne — nie potrzebują sesji ani Supabase
test("/regulamin i /prywatnosc są dostępne bez logowania", async ({ page }) => {
  await page.goto("/regulamin");
  await expect(page).toHaveURL(/\/regulamin$/);
  await expect(page.getByRole("heading", { name: "Regulamin" })).toBeVisible();

  await page.goto("/prywatnosc");
  await expect(page).toHaveURL(/\/prywatnosc$/);
  await expect(page.getByRole("heading", { name: "Polityka prywatności" })).toBeVisible();
});

test.describe("powłoka aplikacji", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("sidebar zostaje przyklejony do góry przy przewinięciu długiej treści (web)", async ({ page }, info) => {
    test.skip(info.project.name !== "web", "sidebar istnieje tylko na webie");
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    // Wydłużamy treść, żeby strona dało się przewinąć
    await page.evaluate(() => {
      const wypelniacz = document.createElement("div");
      wypelniacz.style.height = "3000px";
      document.querySelector("main")!.appendChild(wypelniacz);
    });
    await page.evaluate(() => window.scrollBy(0, 1500));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);

    const sidebar = page.getByRole("navigation", { name: "Główna nawigacja" });
    await expect(sidebar).toBeVisible();
    expect((await sidebar.boundingBox())?.y).toBe(0);
  });

  test("dolny pasek jest przyklejony do dołu i wskazuje aktywny moduł (telefon)", async ({ page }, info) => {
    test.skip(info.project.name !== "mobile", "dolny pasek istnieje tylko na telefonie");
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    const pasek = page.getByRole("navigation", { name: "Moduły" });
    await expect(pasek).toBeVisible();
    await expect(pasek.getByRole("link", { name: "Dziś" })).toHaveAttribute("aria-current", "page");
    const ramka = (await pasek.boundingBox())!;
    expect(Math.round(ramka.y + ramka.height)).toBe(844);
  });
});
