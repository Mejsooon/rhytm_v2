import { expect, test } from "@playwright/test";

import { utworzBooks, zalozKontoStron } from "./helpers/strony";

// Silnik stron: strona z szablonu Books, edytor z tabelą, kosz i telefon.
test.describe("strony", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("Books z szablonu: wiersz „Czytam”, ocena, usunięcie i cofnięcie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Nowy wiersz: tytuł, status Czytam, Zapisz
    await page
      .getByRole("button", { name: "Nowy wiersz", exact: true })
      .click();
    const edycja = page.getByRole("row").filter({
      has: page.getByRole("textbox", { name: "Tytuł" }),
    });
    await edycja.getByRole("textbox", { name: "Tytuł" }).fill("Diuna");
    await edycja.getByRole("button", { name: "Status", exact: true }).click();
    await page.getByRole("option", { name: "Czytam", exact: true }).click();
    await edycja.getByRole("button", { name: "Zapisz", exact: true }).click();

    // Karta „Czytam teraz” liczy się na żywo
    const karta = page.getByText("Czytam teraz", { exact: true }).locator("..");
    await expect(karta).toHaveText(/Czytam teraz\s*1/);
    const wiersz = page.getByRole("row").filter({ hasText: "Diuna" });
    await expect(wiersz).toBeVisible();

    // Edycja oceny: klik w wiersz → 4 gwiazdki → Zapisz
    await wiersz.getByText("Diuna", { exact: true }).click();
    const edycjaOceny = page.getByRole("row").filter({
      has: page.getByRole("textbox", { name: "Tytuł" }),
    });
    await edycjaOceny.getByRole("button", { name: "Ocena 4 na 5" }).click();
    await edycjaOceny
      .getByRole("button", { name: "Zapisz", exact: true })
      .click();
    await expect(page.locator('td[aria-label="Ocena 4 na 5"]')).toBeVisible();

    // Usuń → wiersz znika, Cofnij → wraca
    await page.getByRole("row").filter({ hasText: "Diuna" }).hover();
    await page.getByRole("button", { name: "Usuń wiersz" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "Diuna" }),
    ).toHaveCount(0);
    await expect(karta).toHaveText(/Czytam teraz\s*0/);
    await page.getByRole("button", { name: "Cofnij" }).click();
    await expect(
      page.getByRole("row").filter({ hasText: "Diuna" }),
    ).toBeVisible();
    await expect(karta).toHaveText(/Czytam teraz\s*1/);
  });

  test("edytor: tabela z „/tab”, zmiana typu kolumny Status → Tekst → Liczba, stopka sumy", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);

    await page
      .getByRole("button", { name: "Nowa strona", exact: true })
      .click();
    await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
    await page.getByLabel("Nazwa strony").fill("Plan");
    await page.getByLabel("Nazwa strony").blur();
    // Dla pewności (pas i szelki): wyścig odświeżenia z dodaniem bloku naprawia use-editor-store,
    // a tu i tak czekamy, aż zapis nazwy się skończy
    await page.waitForLoadState("networkidle");

    await page.getByRole("combobox", { name: "Nowy blok" }).fill("/tab");
    await page.getByRole("combobox", { name: "Nowy blok" }).press("Enter");
    await expect(page.getByLabel("Nazwa tabeli")).toBeVisible();

    // Kolumny pojawiają się po odpowiedzi serwera (do tego czasu blok ma tymczasowe id)
    await expect(page.getByRole("columnheader")).toHaveCount(3, {
      timeout: 20_000,
    });
    const naglowek = page.getByRole("columnheader");
    const okno = page.getByRole("dialog", { name: "Ustawienia kolumny" });

    // Status → Tekst: puste wiersze, więc bez potwierdzenia i bez strat
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await okno.getByRole("button", { name: "Tekst", exact: true }).click();
    await expect(
      page.getByRole("dialog", { name: "Zmienić typ pola?" }),
    ).toHaveCount(0);
    await page.keyboard.press("Escape");

    // Wartość „5” w komórce tekstowej, potem typ Liczba → stopka „Suma 5”
    const komorka = page
      .getByRole("textbox", { name: "Status", exact: true })
      .first();
    await komorka.fill("5");
    await komorka.press("Enter");
    await page.waitForLoadState("networkidle");
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await okno.getByRole("button", { name: "Liczba", exact: true }).click();
    await expect(page.getByText(/^Suma 5/)).toBeVisible();
  });

  test("kosz: usunięcie strony → znika z sidebaru → Ustawienia → Kosz → Przywróć → wraca", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    const wSidebarze = page.getByRole("link", { name: "Books", exact: true });
    await expect(wSidebarze).toBeVisible();
    await page.getByRole("button", { name: "Menu strony Books" }).click();
    await page.getByRole("menuitem", { name: "Usuń stronę" }).click();
    const potwierdzenie = page.getByRole("dialog", { name: /Usunąć stronę/ });
    await expect(potwierdzenie).toBeVisible();
    await potwierdzenie
      .getByRole("button", { name: "Usuń", exact: true })
      .click();
    await expect(wSidebarze).toHaveCount(0);

    await page.goto("/ustawienia/ogolne");
    const kosz = page.locator("#kosz");
    await expect(kosz.getByRole("heading", { name: "Kosz" })).toBeVisible();
    const pozycja = kosz.getByRole("listitem", { name: "Books" });
    await expect(pozycja).toContainText("zostało 30 dni");
    await pozycja.getByRole("button", { name: "Przywróć" }).click();
    await expect(kosz.getByText("Kosz jest pusty.")).toBeVisible();

    await page.goto("/strony/nowa");
    await expect(wSidebarze).toBeVisible();
  });

  test("telefon 390 px: lista /strony, „Nowa strona” otwiera edytor z paskiem skrótów", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
    await zalozKontoStron(page, info.project.name);

    await page.goto("/strony");
    await expect(
      page.getByRole("heading", { name: "Strony", level: 1 }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Nowa strona" }).first().click();
    await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
    await expect(
      page.getByRole("button", { name: "Wstaw tabelę" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wstaw zadanie" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Wstaw nagłówek" }),
    ).toBeVisible();

    // Strona pojawia się na liście
    await page.goto("/strony");
    await expect(page.getByRole("link", { name: /Bez tytułu/ })).toBeVisible();
  });
});
