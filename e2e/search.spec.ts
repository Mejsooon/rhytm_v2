import { expect, test } from "@playwright/test";

import { zasiejBlok } from "./helpers/kalendarz";
import { adminClient } from "./helpers/konto";
import { dzisWarszawa, przesunDate, zasiejNawyk } from "./helpers/nawyki";
import { utworzBooks, zalozKontoStron } from "./helpers/strony";

// Szukaj (CMSearch): jedno drzewo dla telefonu i webu, więc teksty nie dublują się w DOM.
// Dane: blok „Matematyka”, nawyk „Czytanie”, strona Books z wierszem „Dune” oraz wiersz „GitHub” w module Hasła.
test.describe("szukaj", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("wyniki w grupach, wiersz tabeli, brak wierszy Haseł i pusty stan", async ({
    page,
  }, info) => {
    const userId = await zalozKontoStron(page, info.project.name);
    const jutro = przesunDate(dzisWarszawa(), 1);
    await zasiejBlok(userId, { title: "Matematyka", date: jutro, startMin: 10 * 60 });
    await zasiejNawyk(userId, { name: "Czytanie" });
    await utworzBooks(page);

    const admin = adminClient();

    // Wiersz „Dune” w tabeli Books: pole tytułowe bloku strony Books
    const { data: books, error: bladStrony } = await admin
      .from("pages")
      .select("id, page_blocks(id, page_fields(id, is_title))")
      .eq("user_id", userId)
      .eq("title", "Books")
      .single();
    if (bladStrony || !books) throw new Error(`Brak strony Books: ${bladStrony?.message}`);
    // Strona z szablonu może mieć też bloki bez tabeli; bierzemy blok z polem tytułowym
    const blokBooks = books.page_blocks.find((b) => b.page_fields.some((p) => p.is_title));
    if (!blokBooks) throw new Error("Strona Books nie ma bloku z polem tytułowym");
    const poleTytulu = blokBooks.page_fields.find((p) => p.is_title);
    const { error: bladDune } = await admin.from("page_rows").insert({
      user_id: userId,
      block_id: blokBooks.id,
      position: 0,
      values: { [poleTytulu!.id]: "Dune" },
    });
    if (bladDune) throw new Error(`Nie udało się zasiać wiersza: ${bladDune.message}`);

    // Moduł Hasła: odwiedziny zakładają stronę systemową, potem zasiewamy wiersz „GitHub” (Serwis + Login)
    await page.goto("/hasla");
    await expect
      .poll(async () => {
        const { data } = await admin
          .from("pages")
          .select("id")
          .eq("user_id", userId)
          .eq("is_system", true);
        return data?.length ?? 0;
      })
      .toBe(1);
    const { data: hasla, error: bladHasel } = await admin
      .from("pages")
      .select("id, page_blocks(id, page_fields(id, name))")
      .eq("user_id", userId)
      .eq("is_system", true)
      .single();
    if (bladHasel || !hasla) throw new Error(`Brak strony Hasła: ${bladHasel?.message}`);
    const blokHasel = hasla.page_blocks.find((b) => b.page_fields.some((p) => p.name === "Serwis"));
    if (!blokHasel) throw new Error("Strona Hasła nie ma bloku z polem Serwis");
    const pole = (nazwa: string) => blokHasel.page_fields.find((p) => p.name === nazwa)!.id;
    const { error: bladGithub } = await admin.from("page_rows").insert({
      user_id: userId,
      block_id: blokHasel.id,
      position: 0,
      values: { [pole("Serwis")]: "GitHub", [pole("Login")]: "git-konto" },
    });
    if (bladGithub) throw new Error(`Nie udało się zasiać wiersza Haseł: ${bladGithub.message}`);

    await page.goto("/szukaj");
    // Treść modułu: pasek boczny na webie ma własne linki „Kalendarz”, „Strony” i „Hasła”
    const tresc = page.locator("main");
    const poleSzukaj = tresc.getByRole("searchbox", { name: "Szukaj" });
    await expect(poleSzukaj).toBeVisible();
    await expect(tresc.getByText("Szybkie akcje")).toBeVisible();

    // „mat” → blok w grupie „Kalendarz”, link prowadzi do dnia bloku
    await poleSzukaj.fill("mat");
    await expect(tresc.getByText("Kalendarz", { exact: true })).toBeVisible();
    const blok = tresc.getByRole("link", { name: /Matematyka/ });
    await expect(blok).toContainText("10:00");
    await expect(blok).toHaveAttribute(
      "href",
      `/kalendarz?widok=dzien&data=${jutro}`,
    );
    await blok.click();
    await expect(page).toHaveURL(new RegExp(`/kalendarz\\?widok=dzien&data=${jutro}`));

    // „dune” → wiersz w grupie „Strony”, link do strony Books
    await page.goto("/szukaj");
    await poleSzukaj.fill("dune");
    await expect(tresc.getByText("Strony", { exact: true })).toBeVisible();
    const wiersz = tresc.getByRole("link", { name: /Dune/ });
    await expect(wiersz).toContainText("w Books");
    await expect(wiersz).toHaveAttribute("href", `/strony/${books.id}`);

    // „czyt” → nawyk z serią
    await poleSzukaj.fill("czyt");
    await expect(tresc.getByText("Nawyki", { exact: true })).toBeVisible();
    await expect(tresc.getByRole("link", { name: /Czytanie/ })).toContainText("seria");

    // „git”: wiersz „GitHub” i login „git-konto” z Haseł nie trafiają do wyników
    await poleSzukaj.fill("git");
    await expect(tresc.getByText("Nic nie znaleziono dla „git”")).toBeVisible();
    await expect(tresc.getByRole("link", { name: /GitHub/ })).toHaveCount(0);
    await expect(tresc.getByText("git-konto")).toHaveCount(0);

    // Sama strona Hasła jest dostępna po tytule (bez wierszy i liczników)
    await poleSzukaj.fill("hasła");
    const stronaHasel = tresc.getByRole("link", { name: /Hasła/ });
    await expect(stronaHasel).toHaveAttribute("href", "/hasla");
    await expect(stronaHasel).toContainText("moduł");

    // „xyz” → pusty stan
    await poleSzukaj.fill("xyz");
    await expect(tresc.getByText("Nic nie znaleziono dla „xyz”")).toBeVisible();
  });

  test("wejście z aplikacji: lupa na Dziś (telefon), pole w pasku bocznym i Ctrl+K (web)", async ({
    page,
  }, info) => {
    await zalozKontoStron(page, info.project.name);
    if (info.project.name === "mobile") {
      await page
        .getByRole("link", { name: "Szukaj", exact: true })
        .filter({ visible: true })
        .click();
      await expect(page).toHaveURL(/\/szukaj$/);
      // Telefon: pole ma fokus od razu, „Anuluj” wraca na Dziś
      await expect(page.getByRole("searchbox", { name: "Szukaj" })).toBeFocused();
      await page.getByRole("button", { name: "Anuluj" }).click();
      await expect(page).toHaveURL(/\/dzis$/);
      return;
    }
    await page
      .getByRole("navigation", { name: "Główna nawigacja" })
      .getByRole("link", { name: /Szukaj…/ })
      .click();
    await expect(page).toHaveURL(/\/szukaj$/);
    await page.goto("/dzis");
    // Nasłuch skrótu dochodzi po hydratacji paska, więc ponawiamy wciśnięcie
    await expect(async () => {
      await page.keyboard.press("Control+k");
      await expect(page).toHaveURL(/\/szukaj$/, { timeout: 1000 });
    }).toPass();
  });

  test("szybkie akcje otwierają okna w modułach", async ({ page }, info) => {
    await zalozKontoStron(page, info.project.name);
    await page.goto("/szukaj");
    await page.getByRole("link", { name: "Wpis snu" }).click();
    await expect(page).toHaveURL(/\/nawyki/);
    await expect(
      page.getByRole("dialog", { name: "Wpis snu" }).filter({ visible: true }),
    ).toBeVisible();

    await page.goto("/szukaj");
    await page.getByRole("link", { name: "Nowy blok" }).click();
    await expect(page).toHaveURL(/\/dzis$/);
    await expect(
      page.getByRole("dialog", { name: /^(Nowy blok|Szybko dodaj)$/ }).filter({ visible: true }),
    ).toBeVisible();
  });
});
