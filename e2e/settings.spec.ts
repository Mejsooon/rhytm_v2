import { expect, test } from "@playwright/test";

import {
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./helpers/konto";

test.describe("ustawienia ogólne", () => {
  // Krótszy limit akcji: przy błędzie widać, która linia utknęła (a nie ogólny timeout testu)
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("zmiana nazwy, walidacja wagi i cel snu", async ({ page }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia");
    await expect(page).toHaveURL(/\/ustawienia\/ogolne$/);
    // Regresja: pasek zakładek nie może poszerzać strony (na telefonie przeglądarka oddaliłaby widok)
    await expect(
      page.getByRole("heading", { name: "Profil", exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);

    // Karta Profil: nazwa → komunikat o zmianach → zapis
    const profil = page.getByTestId("karta-profil");
    // Wiersz zdjęcia profilowego bez zdjęcia (samo wgrywanie wymaga Storage, którego CI nie ma)
    await expect(
      profil.getByText("Bez zdjęcia pokażemy inicjały"),
    ).toBeVisible();
    await expect(profil.getByRole("button", { name: "Wgraj" })).toBeVisible();
    await expect(profil.getByRole("button", { name: "Usuń" })).toHaveCount(0);
    const nazwa = profil.getByLabel("Wyświetlana nazwa");
    await nazwa.fill("Nowa Nazwa");
    await expect(profil.getByText("Masz niezapisane zmiany.")).toBeVisible();
    await profil.getByRole("button", { name: "Zapisz" }).click();
    await expect(profil.getByText("Zapisano ✓")).toBeVisible();

    // Po odświeżeniu nowa nazwa jest w polu, a na webie także w sidebarze
    await page.reload();
    await expect(page.getByLabel("Wyświetlana nazwa")).toHaveValue(
      "Nowa Nazwa",
    );
    if (info.project.name === "web") {
      await expect(
        page
          .getByRole("navigation", { name: "Główna nawigacja" })
          .getByText("Nowa Nazwa"),
      ).toBeVisible();
    }

    // Karta Cele: cel snu 8:00 → „+” → 8:15 → zapis
    const cele = page.getByTestId("karta-cele");
    await expect(cele.getByText("8:00", { exact: true })).toBeVisible();
    await cele.getByRole("button", { name: "Zwiększ Cel snu" }).click();
    await expect(cele.getByText("8:15", { exact: true })).toBeVisible();
    await expect(cele.getByText("Masz niezapisane zmiany.")).toBeVisible();
    await cele.getByRole("button", { name: "Zapisz" }).click();
    await expect(cele.getByText(/Zapisano ✓/)).toBeVisible();

    await page.reload();
    await expect(
      page.getByTestId("karta-cele")
        .getByText("8:15", { exact: true }),
    ).toBeVisible();

    // Cele treningowe: nowe konto ma oba włączone (3 treningi, 25 km) → wyłączamy km, treningi 5 → zapis
    const cele2 = page.getByTestId("karta-cele");
    await expect(
      cele2.getByRole("checkbox", { name: "Treningi w tygodniu" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      cele2.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      cele2.getByRole("textbox", { name: "Treningi w tygodniu" }),
    ).toHaveValue("3");
    await expect(
      cele2.getByRole("textbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveValue("25");
    await cele2
      .getByRole("checkbox", { name: "Kilometry biegu w tygodniu" })
      .click();
    await expect(cele2.getByText("wył.")).toBeVisible();
    await cele2
      .getByRole("textbox", { name: "Treningi w tygodniu" })
      .fill("15");
    await expect(cele2.getByText("Treningi: Podaj liczbę 1–14.")).toBeVisible();
    await expect(cele2.getByRole("button", { name: "Zapisz" })).toBeDisabled();
    await cele2.getByRole("textbox", { name: "Treningi w tygodniu" }).fill("5");
    await cele2.getByRole("button", { name: "Zapisz" }).click();
    await expect(cele2.getByText(/Zapisano ✓/)).toBeVisible();

    await page.reload();
    const cele3 = page.getByTestId("karta-cele");
    await expect(
      cele3.getByRole("textbox", { name: "Treningi w tygodniu" }),
    ).toHaveValue("5");
    await expect(
      cele3.getByRole("checkbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveAttribute("aria-checked", "false");
    await cele3.getByRole("checkbox", { name: "Treningi w tygodniu" }).click();
    await expect(cele3.getByText("Włącz co najmniej jeden cel.")).toBeVisible();
    await expect(cele3.getByRole("button", { name: "Zapisz" })).toBeDisabled();
    await cele3
      .getByRole("checkbox", { name: "Kilometry biegu w tygodniu" })
      .click();
    await expect(
      cele3.getByRole("textbox", { name: "Kilometry biegu w tygodniu" }),
    ).toHaveValue("25");
    await cele3.getByRole("button", { name: "Cofnij" }).click();

    // Waga poza zakresem: błąd i nieaktywny „Zapisz”
    const profil2 = page.getByTestId("karta-profil");
    await profil2.getByLabel("Waga (kg)").fill("20");
    await expect(profil2.getByText("Podaj liczbę 30–250.")).toBeVisible();
    await expect(
      profil2.getByRole("button", { name: "Zapisz" }),
    ).toBeDisabled();
  });
});
