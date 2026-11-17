import { expect, test } from "@playwright/test";

import { createConfirmedUser, logInViaForm, randomPassword, uniqueEmail } from "./helpers/konto";

test.describe("ustawienia ogólne", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("zmiana nazwy, walidacja wagi i cel snu", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia");
    await expect(page).toHaveURL(/\/ustawienia\/ogolne$/);

    // Karta Profil: nazwa → komunikat o zmianach → zapis
    const profil = page.locator("section", { has: page.getByRole("heading", { name: "Profil", exact: true }) });
    const nazwa = profil.getByLabel("Wyświetlana nazwa");
    await nazwa.fill("Nowa Nazwa");
    await expect(profil.getByText("Masz niezapisane zmiany.")).toBeVisible();
    await profil.getByRole("button", { name: "Zapisz" }).click();
    await expect(profil.getByText("Zapisano ✓")).toBeVisible();

    // Po odświeżeniu nowa nazwa jest w polu, a na webie także w sidebarze
    await page.reload();
    await expect(page.getByLabel("Wyświetlana nazwa")).toHaveValue("Nowa Nazwa");
    if (info.project.name === "web") {
      await expect(page.getByRole("navigation", { name: "Główna nawigacja" }).getByText("Nowa Nazwa")).toBeVisible();
    }

    // Waga poza zakresem: błąd i nieaktywny „Zapisz”
    const profil2 = page.locator("section", { has: page.getByRole("heading", { name: "Profil", exact: true }) });
    await profil2.getByLabel("Waga (kg)").fill("20");
    await expect(profil2.getByText("Podaj liczbę 30–250.")).toBeVisible();
    await expect(profil2.getByRole("button", { name: "Zapisz" })).toBeDisabled();

    // Karta Cele: cel snu 8:00 → „+” → 8:15 → zapis
    const cele = page.locator("section", { has: page.getByRole("heading", { name: "Cele", exact: true }) });
    await expect(cele.getByText("8:00", { exact: true })).toBeVisible();
    await cele.getByRole("button", { name: "Zwiększ Cel snu" }).click();
    await expect(cele.getByText("8:15", { exact: true })).toBeVisible();
    await expect(cele.getByText("Masz niezapisane zmiany.")).toBeVisible();
    await cele.getByRole("button", { name: "Zapisz" }).click();
    await expect(cele.getByText(/Zapisano ✓/)).toBeVisible();

    await page.reload();
    await expect(
      page.locator("section", { has: page.getByRole("heading", { name: "Cele", exact: true }) }).getByText("8:15", { exact: true }),
    ).toBeVisible();
  });
});
