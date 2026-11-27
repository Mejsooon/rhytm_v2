import { readFileSync } from "node:fs";

import { expect, test, type Response } from "@playwright/test";

import { adminClient } from "./helpers/konto";

import {
  utworzBooks,
  utworzProjekty,
  utworzSubscriptions,
  zalozKontoStron,
  zasiejPustaStrone,
  zasiejWiersze,
} from "./helpers/strony";

// Silnik stron: strona z szablonu Books, edytor z tabelą, kosz i telefon.
// Tabela edytuje się wprost w komórkach. Zmiany widać od razu, a zapis to akcja serwera Next.
// Gdy liczy się kolejność zapisów albo jest potem przeładowanie, czekamy na odpowiedź tej jednej akcji
// (AKCJA_SERWERA); gdzie wystarczy, czekamy na stan widoku.

// Odpowiedź akcji serwera Next: POST z nagłówkiem next-action (a nie dowolne żądanie POST)
const AKCJA_SERWERA = (o: Response) =>
  o.request().method() === "POST" &&
  o.request().headers()["next-action"] !== undefined;
test.describe("strony", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("Books z szablonu: wiersz „Czytam” w komórkach, ocena, usunięcie i cofnięcie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // „Nowy wiersz” zakłada wiersz na serwerze (pojawia się po odpowiedzi) i stawia kursor w komórce tytułu
    await page.getByRole("button", { name: "Nowy wiersz", exact: true }).last().click();
    const wiersz = page.locator("tbody tr:has(input)");
    await expect(wiersz).toHaveCount(1);
    const tytul = wiersz.getByRole("textbox", { name: "Tytuł", exact: true });
    await expect(tytul).toBeFocused();

    // Tytuł: wpis i Enter (zapis od razu, bez czekania 600 ms)
    const zapisTytulu = page.waitForResponse(AKCJA_SERWERA);
    await tytul.fill("Diuna");
    await tytul.press("Enter");
    await zapisTytulu;
    await expect(tytul).toHaveValue("Diuna");
    await expect(tytul).not.toBeFocused();

    // Status: okienko opcji → „Szukaj lub dodaj opcję” → wybór „Czytam”
    const status = wiersz.getByRole("button", { name: /^Status: / });
    await status.click();
    await page
      .getByRole("textbox", { name: "Szukaj lub dodaj opcję" })
      .fill("Czyt");
    const zapisStatusu = page.waitForResponse(AKCJA_SERWERA);
    await page.getByRole("option", { name: "Czytam", exact: true }).click();
    await zapisStatusu;
    await expect(status).toHaveText("Czytam");

    // Karta „Czytam teraz” liczy się na żywo
    const karta = page.getByTestId("karta").filter({ hasText: "Czytam teraz" });
    await expect(karta).toHaveText(/Czytam teraz\s*1/);

    // Ocena: czwarta gwiazdka w komórce
    const gwiazdka = wiersz.getByRole("button", { name: "Ocena 4 na 5" });
    const zapisOceny = page.waitForResponse(AKCJA_SERWERA);
    await gwiazdka.click();
    await zapisOceny;
    await expect(gwiazdka).toHaveAttribute("aria-pressed", "true");
    await expect(
      wiersz.getByRole("button", { name: "Ocena 5 na 5" }),
    ).toHaveAttribute("aria-pressed", "false");

    // Kosz „Usuń wiersz” → wiersz znika, „Cofnij” → wraca z tytułem i statusem
    await wiersz.hover();
    await wiersz.getByRole("button", { name: "Usuń wiersz" }).click();
    await expect(wiersz).toHaveCount(0);
    await expect(karta).toHaveText(/Czytam teraz\s*0/);
    // „Cofnij” pojawia się dopiero po zapisanym usunięciu
    await page.getByRole("button", { name: "Cofnij" }).click();
    await expect(wiersz).toHaveCount(1);
    await expect(tytul).toHaveValue("Diuna");
    await expect(status).toHaveText("Czytam");
    await expect(karta).toHaveText(/Czytam teraz\s*1/);
  });

  // Cztery książki w różnych statusach (zasiew przez API administratora) i odświeżenie strony
  const KSIAZKI = [
    { Tytuł: "Atomic Habits", Autor: "James Clear", Status: "Czytam" },
    { Tytuł: "Deep Work", Autor: "Cal Newport", Status: "Przeczytane", Ocena: 4, Przeczytana: "2026-10-12" },
    { Tytuł: "Diuna", Autor: "Frank Herbert", Status: "Przeczytane", Ocena: 5, Przeczytana: "2026-06-15" },
    { Tytuł: "Clean Code", Autor: "Robert C. Martin", Status: "Chcę przeczytać" },
  ];

  test("widoki: zakładka szablonu i nowy widok z filtra zostają wybrane po odświeżeniu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);
    await zasiejWiersze(userId, page.url().split("/").at(-1)!, KSIAZKI);
    await page.reload();
    const wiersze = page.locator("tbody tr:has(input)");
    await expect(wiersze).toHaveCount(4);

    // Zakładki szablonu z liczbą wierszy; „Czytam” zawęża tabelę
    const zakladki = page.getByRole("group", { name: "Zapisane widoki" });
    const czytam = zakladki.getByRole("button", { name: /^Czytam\s*1$/ });
    const zapisWidoku = page.waitForResponse(AKCJA_SERWERA);
    await czytam.click();
    await zapisWidoku;
    await expect(czytam).toHaveAttribute("aria-pressed", "true");
    await expect(wiersze).toHaveCount(1);
    await page.reload();
    await expect(czytam).toHaveAttribute("aria-pressed", "true");
    await expect(wiersze).toHaveCount(1);

    // „Wszystkie” → filtr Status „Czytam” → „Zapisz jako widok” → „Mój widok 1” z jedną książką
    await zakladki.getByRole("button", { name: /^Wszystkie/ }).click();
    await expect(wiersze).toHaveCount(4);
    await page.getByRole("button", { name: "Filtruj", exact: true }).click();
    const filtr = page.getByRole("dialog", { name: "Filtr" });
    await filtr.getByRole("checkbox", { name: "Czytam" }).click();
    await expect(wiersze).toHaveCount(1);
    const zapisNowego = page.waitForResponse(AKCJA_SERWERA);
    await filtr.getByRole("button", { name: "Zapisz jako widok" }).click();
    await zapisNowego;
    const moj = zakladki.getByRole("button", { name: /^Mój widok 1\s*1$/ });
    await expect(moj).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(moj).toHaveAttribute("aria-pressed", "true");
    await expect(wiersze).toHaveCount(1);
    await expect(page.getByRole("textbox", { name: "Tytuł", exact: true })).toHaveValue("Atomic Habits");
    // „Wszystkie” bez filtra (zapis jako widok czyści filtr „Wszystkich”)
    await zakladki.getByRole("button", { name: /^Wszystkie/ }).click();
    await expect(wiersze).toHaveCount(4);
  });

  test("grupy: Książki grupowane po Statusie, zwinięcie grupy zostaje po odświeżeniu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);
    await zasiejWiersze(userId, page.url().split("/").at(-1)!, KSIAZKI);
    await page.reload();
    const wiersze = page.locator("tbody tr:has(input)");
    await expect(wiersze).toHaveCount(4);
    await expect(page.getByRole("button", { name: /^Grupuj: Status/ })).toBeVisible();
    // Nagłówek grupy „Przeczytane”: liczba i średnia ocena grupy
    await expect(page.getByText("śr. ocena 4,5", { exact: true })).toBeVisible();

    const zapisZwiniecia = page.waitForResponse(AKCJA_SERWERA);
    await page.getByRole("button", { name: "Zwiń grupę Przeczytane" }).click();
    await zapisZwiniecia;
    await expect(wiersze).toHaveCount(2);
    await expect(page.getByText("zwinięte · 2 ukryte", { exact: true })).toBeVisible();
    // Zapis ustawień może iść w kilku akcjach (kolejka magazynu): czekamy, aż sieć ucichnie
    await page.waitForLoadState("networkidle");
    await page.reload();
    await expect(wiersze).toHaveCount(2);
    await page.getByRole("button", { name: "Rozwiń grupę Przeczytane" }).click();
    await expect(wiersze).toHaveCount(4);

    // Bez grupowania: jedna lista bez nagłówków grup
    await page.getByRole("button", { name: /^Grupuj: Status/ }).click();
    await page.getByRole("menuitemradio", { name: "Bez grupowania" }).click();
    await expect(page.getByRole("button", { name: /grupę Przeczytane/ })).toHaveCount(0);
    await expect(wiersze).toHaveCount(4);
  });

  test("tablica: Projekty, przeciągnięcie karty do „Zrobione” zmienia Status i zostaje po odświeżeniu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);
    await utworzProjekty(page);
    await zasiejWiersze(userId, page.url().split("/").at(-1)!, [
      { Nazwa: "rhytm", Status: "W toku", Obszar: "Własne" },
      { Nazwa: "Projekt z baz danych", Status: "Do zrobienia", Obszar: "Studia" },
    ]);
    await page.reload();
    await page.getByRole("button", { name: "Tablica", exact: true }).click();
    const wToku = page.getByRole("region", { name: "W toku" });
    const zrobione = page.getByRole("region", { name: "Zrobione" });
    await expect(wToku.getByRole("article", { name: "rhytm" })).toBeVisible();

    const zapis = page.waitForResponse(AKCJA_SERWERA);
    await wToku.getByRole("article", { name: "rhytm" }).dragTo(zrobione);
    await zapis;
    await expect(zrobione.getByRole("article", { name: "rhytm" })).toBeVisible();
    await expect(wToku.getByRole("article", { name: "rhytm" })).toHaveCount(0);

    // Układ „Tablica” i nowy Status zostają po odświeżeniu
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Tablica", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      page.getByRole("region", { name: "Zrobione" }).getByRole("article", { name: "rhytm" }),
    ).toBeVisible();
  });

  test("CSV: import pliku z Excela (BOM, „;”, polskie liczby i daty) i eksport całej tabeli", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);
    const idStrony = page.url().split("/").at(-1)!;

    // Import: „⋯” → „Importuj z CSV…” → plik → dopasowanie (Cena jako nowe pole Liczba) → „Importuj 2 wiersze”
    await page.getByRole("button", { name: "Menu tabeli" }).click();
    await page.getByRole("menuitem", { name: "Importuj z CSV…" }).click();
    const okno = page.getByRole("dialog", { name: "Importuj z CSV" });
    await okno.getByLabel("Plik CSV").setInputFiles({
      name: "ksiazki.csv",
      mimeType: "text/csv",
      buffer: Buffer.from(
        "\uFEFFTytuł;Autor;Przeczytana;Cena\r\nDiuna;Frank Herbert;15.06.2026;43,50\r\n„Sapiens”;Yuval Noah Harari;11.12.2025;1 234,99\r\n;;;\r\n\r\n",
        "utf8",
      ),
    });
    await expect(okno.getByText("ksiazki.csv")).toBeVisible();
    await okno
      .getByRole("combobox", { name: "Pole dla kolumny Cena" })
      .selectOption({ label: "Nowe pole · Liczba" });
    const zapisImportu = page.waitForResponse(AKCJA_SERWERA);
    await okno.getByRole("button", { name: "Importuj 2 wiersze" }).click();
    await zapisImportu;
    await okno.getByRole("button", { name: "Gotowe" }).click();
    const wiersze = page.locator("tbody tr:has(input)");
    await expect(wiersze).toHaveCount(2);
    await expect(
      page.getByRole("columnheader").getByRole("button", { name: "Cena", exact: true }),
    ).toBeVisible();

    // W bazie: liczby i daty przeliczone z zapisu polskiego, bez pustych wierszy z końca pliku
    const admin = adminClient();
    const { data: blok } = await admin
      .from("page_blocks")
      .select("id")
      .eq("page_id", idStrony)
      .eq("type", "table")
      .single();
    const { data: pola } = await admin
      .from("page_fields")
      .select("id, name")
      .eq("block_id", blok!.id);
    const id = (nazwa: string) => pola!.find((f) => f.name === nazwa)!.id;
    const { data: zapisane } = await admin
      .from("page_rows")
      .select("values")
      .eq("block_id", blok!.id)
      .is("deleted_at", null);
    const poTytule = new Map(
      zapisane!.map((r) => [(r.values as Record<string, unknown>)[id("Tytuł")], r.values as Record<string, unknown>]),
    );
    expect(poTytule.size).toBe(2);
    expect(poTytule.get("Diuna")?.[id("Cena")]).toBe(43.5);
    expect(poTytule.get("Diuna")?.[id("Przeczytana")]).toBe("2026-06-15");
    expect(poTytule.get("„Sapiens”")?.[id("Cena")]).toBe(1234.99);

    // Eksport całej tabeli: plik „Książki.csv” z nagłówkiem pól i obiema książkami
    await page.getByRole("button", { name: "Menu tabeli" }).click();
    const pobranie = page.waitForEvent("download");
    await page.getByRole("menuitem", { name: "Eksportuj całą tabelę (CSV)" }).click();
    const plik = await pobranie;
    expect(plik.suggestedFilename()).toBe("Książki.csv");
    const csv = readFileSync(await plik.path(), "utf8").replace(/^\uFEFF/, "");
    const [naglowek, ...reszta] = csv.split("\r\n").filter((l) => l !== "");
    expect(naglowek.split(",")).toEqual(expect.arrayContaining(["Tytuł", "Autor", "Status", "Cena"]));
    expect(reszta).toHaveLength(2);
    expect(csv).toContain("Diuna");
  });

  test("zaznaczanie: trzy wiersze → „Usuń” → „Cofnij” przywraca wszystkie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);
    await zasiejWiersze(userId, page.url().split("/").at(-1)!, KSIAZKI);
    await page.reload();
    const wiersze = page.locator("tbody tr:has(input)");
    await expect(wiersze).toHaveCount(4);

    for (const tytul of ["Atomic Habits", "Deep Work", "Clean Code"])
      await page.getByRole("checkbox", { name: `Zaznacz: ${tytul}` }).check();
    const pasek = page.getByRole("toolbar", { name: "Akcje dla zaznaczonych" });
    await expect(pasek).toContainText("3");
    const usuniecie = page.waitForResponse(AKCJA_SERWERA);
    await pasek.getByRole("button", { name: "Usuń" }).click();
    await usuniecie;
    await expect(wiersze).toHaveCount(1);
    await expect(pasek).toHaveCount(0);
    await expect(page.getByText("Usunięto 3 wiersze")).toBeVisible();

    await page.getByRole("button", { name: "Cofnij" }).click();
    await expect(wiersze).toHaveCount(4);
    await page.reload();
    await expect(wiersze).toHaveCount(4);
  });

  test("Subscriptions: szablon, kwota, cykl, sumy", async ({ page }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzSubscriptions(page);

    const sumaMiesieczna = page.getByTestId("karta").filter({ hasText: "Σ miesięcznie" });
    const sumaRoczna = page.getByTestId("karta").filter({ hasText: "Σ rocznie" });
    const najblizsze = page.getByTestId("karta").filter({ hasText: "Najbliższe odnowienie" });

    // „Nowy wiersz”: nazwa „Netflix” (Enter zapisuje od razu), potem kwota 43 (zapis przy pisaniu)
    await page.getByRole("button", { name: "Nowy wiersz", exact: true }).last().click();
    const wiersz = page.locator("tbody tr:has(input)");
    await expect(wiersz).toHaveCount(1);
    const nazwa = wiersz.getByRole("textbox", { name: "Nazwa", exact: true });
    const zapisNazwy = page.waitForResponse(AKCJA_SERWERA);
    await nazwa.fill("Netflix");
    await nazwa.press("Enter");
    await zapisNazwy;
    const kwota = wiersz.getByRole("textbox", { name: "Kwota cykliczna", exact: true });
    const zapisKwoty = page.waitForResponse(AKCJA_SERWERA);
    await kwota.fill("43");
    await zapisKwoty;
    await expect(sumaMiesieczna).toContainText("43,00");
    await expect(sumaRoczna).toContainText("516,00");

    // Cykl „/ rok”: 43 zł rocznie to 3,58 zł miesięcznie
    const zapisCyklu = page.waitForResponse(AKCJA_SERWERA);
    await wiersz.getByRole("button", { name: /^Cykl: mies\./ }).click();
    await zapisCyklu;
    await expect(wiersz.getByRole("button", { name: /^Cykl: rok/ })).toBeVisible();
    await expect(sumaMiesieczna).toContainText("3,58");

    // Nowy wiersz jest „Aktywna”; odznaczenie zeruje sumy i daje plakietkę „anulowana”
    const aktywna = wiersz.getByRole("checkbox", { name: "Aktywna" });
    await expect(aktywna).toBeChecked();
    const zapisAktywnej = page.waitForResponse(AKCJA_SERWERA);
    await aktywna.click();
    await zapisAktywnej;
    await expect(sumaMiesieczna).toContainText("0,00");
    await expect(sumaRoczna).toContainText("0,00");
    await expect(wiersz.getByText("anulowana")).toBeVisible();

    // Data odnowienia „Dziś”: wiersz nieaktywny, więc karta mówi „Brak odnowień”
    await wiersz.getByRole("button", { name: /^Data odnowienia: / }).click();
    const zapisDaty = page.waitForResponse(AKCJA_SERWERA);
    await page.getByRole("button", { name: "Dziś", exact: true }).click();
    await zapisDaty;
    await expect(najblizsze).toContainText("Brak odnowień");

    // Po zaznaczeniu „Aktywna” karta pokazuje Netflix i „dziś”
    const zapisPonowny = page.waitForResponse(AKCJA_SERWERA);
    await aktywna.click();
    await zapisPonowny;
    await expect(najblizsze).toContainText("Netflix");
    await expect(najblizsze).toContainText("dziś");
  });

  test("Subscriptions: pole „Kwota cykliczna” z „+” i stopka „Suma / mies.”", async ({ page }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);

    // Pusta strona z tabelą z menu „/” (3 pola i nagłówek z „+”)
    const idStrony = await zasiejPustaStrone(userId, "Wydatki");
    await page.goto(`/strony/${idStrony}`);
    await page.getByRole("combobox", { name: "Nowy blok" }).fill("/tab");
    await page.getByRole("combobox", { name: "Nowy blok" }).press("Enter");
    await expect(page.getByRole("group", { name: "Zapisane widoki" })).toBeVisible();
    // 3 pola, „+” oraz zaznaczanie i „#” (S2Table)
    await expect(page.getByRole("columnheader")).toHaveCount(6, { timeout: 20_000 });

    // „+” → okno „Nowe pole” → grupa „Inteligentne” → Kwota cykliczna (domyślna nazwa „Cena”)
    await page.getByRole("button", { name: "Dodaj kolumnę" }).click();
    const okno = page.getByRole("dialog", { name: "Nowe pole" });
    await expect(okno.getByText("Inteligentne", { exact: true })).toBeVisible();
    await okno.getByRole("button", { name: /Kwota cykliczna/ }).click();
    await expect(okno.getByRole("textbox", { name: "Nazwa pola" })).toHaveValue("Cena");
    const dodanie = page.waitForResponse(AKCJA_SERWERA);
    await okno.getByRole("button", { name: "Dodaj pole" }).click();
    await dodanie;
    const naglowek = page.getByRole("columnheader");
    await expect(naglowek).toHaveCount(7, { timeout: 20_000 });
    await expect(naglowek.getByRole("button", { name: "Cena", exact: true })).toBeVisible();

    // Kwota 43 w pierwszym wierszu, podsumowanie „Suma / mies.” → stopka „Σ 43,00 zł / mies.”
    const kwota = page.locator("tbody tr:has(input)").first().getByRole("textbox", { name: "Cena", exact: true });
    const zapisKwoty = page.waitForResponse(AKCJA_SERWERA);
    await kwota.fill("43");
    await zapisKwoty;
    await naglowek.getByRole("button", { name: "Cena", exact: true }).click();
    await page.getByRole("dialog", { name: "Kolumna Cena" }).getByRole("menuitem", { name: /^Podsumowanie/ }).click();
    await page
      .getByRole("menu", { name: "Podsumowanie" })
      .getByRole("menuitem", { name: "Suma / mies.", exact: true })
      .click();
    await expect(page.locator("tfoot").getByRole("cell", { name: "Σ 43,00 zł / mies." })).toBeVisible();
  });

  test("opcje z komórki: „Utwórz «Porzucone»” od razu ją wybiera, zmiana koloru i usunięcie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Stan kolumny Status i wiersza w bazie: „Utwórz” i „Usuń opcję” wysyłają po dwie akcje
    // (pole i komórka), więc zamiast liczyć odpowiedzi czekamy, aż baza pokaże ich wynik
    async function stanWBazie() {
      const { data: pola, error: bladPol } = await adminClient()
        .from("page_fields")
        .select("id, config")
        .eq("user_id", userId)
        .eq("name", "Status");
      if (bladPol) throw bladPol;
      const { data: wiersze, error: bladWierszy } = await adminClient()
        .from("page_rows")
        .select("values")
        .eq("user_id", userId)
        .is("deleted_at", null);
      if (bladWierszy) throw bladWierszy;
      const pole = pola?.[0] as
        | { id: string; config: { options?: { id: string; label: string; color: string }[] } }
        | undefined;
      const opcja = pole?.config.options?.find((o) => o.label === "Porzucone");
      const wartosc = pole
        ? (wiersze?.[0]?.values as Record<string, unknown> | undefined)?.[pole.id]
        : undefined;
      return {
        opcja: opcja?.color ?? "brak",
        komorka:
          opcja !== undefined && wartosc === opcja.id ? "Porzucone" : (wartosc ?? null),
      };
    }

    // „Nowy wiersz” zakłada wiersz na serwerze: wiersz pojawia się dopiero po odpowiedzi
    await page.getByRole("button", { name: "Nowy wiersz", exact: true }).last().click();
    const wiersz = page.locator("tbody tr:has(input)");
    await expect(wiersz).toHaveCount(1);
    const status = wiersz.getByRole("button", { name: /^Status: / });
    await expect(status).toHaveText("Chcę przeczytać");

    // „Utwórz «Porzucone»”: nowa (szara) opcja od razu trafia do komórki, okienko się zamyka
    await status.click();
    const szukaj = page.getByRole("textbox", { name: "Szukaj lub dodaj opcję" });
    await szukaj.fill("Porzucone");
    await page.getByRole("button", { name: "Utwórz «Porzucone»" }).click();
    await expect(szukaj).toHaveCount(0);
    await expect(status).toHaveText("Porzucone");
    await expect
      .poll(stanWBazie, { timeout: 10_000 })
      .toEqual({ opcja: "#525252", komorka: "Porzucone" });

    // „⋯” przy opcji → panel „Edycja opcji” → kolor Czerwony (jedna akcja: zapis pola)
    await status.click();
    const opcja = page.getByRole("option", { name: "Porzucone", exact: true });
    await opcja.hover();
    await page.getByRole("button", { name: "Edytuj opcję „Porzucone”" }).click();
    const panel = page.getByRole("group", { name: "Edycja opcji" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("textbox", { name: "Nazwa opcji" })).toHaveValue(
      "Porzucone",
    );
    await expect(
      panel.getByRole("button", { name: "Szary", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await panel.getByRole("button", { name: "Czerwony", exact: true }).click();
    await expect(
      panel.getByRole("button", { name: "Czerwony", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    // Kolor musi być zapisany przed usunięciem: inaczej spóźniony zapis koloru mógłby przywrócić opcję
    await expect
      .poll(stanWBazie, { timeout: 10_000 })
      .toEqual({ opcja: "#b91c1c", komorka: "Porzucone" });

    // „Usuń opcję”: komórka pustoszeje, panel wraca do listy, opcji nie ma
    await panel.getByRole("button", { name: "Usuń opcję" }).click();
    await expect(panel).toHaveCount(0);
    await expect(opcja).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(status).toHaveText("—");
    await expect
      .poll(stanWBazie, { timeout: 10_000 })
      .toEqual({ opcja: "brak", komorka: null });

    // Po przeładowaniu opcji nadal nie ma, a pozostałe są
    await page.reload();
    await expect(wiersz).toHaveCount(1);
    await expect(status).toHaveText("—");
    await status.click();
    await expect(
      page.getByRole("option", { name: "Czytam", exact: true }),
    ).toBeVisible();
    await expect(opcja).toHaveCount(0);
  });

  test("szerokość kolumny: strzałka w prawo na uchwycie, trwała po przeładowaniu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Autor to kolumna tekstowa: domyślnie 220 px, krok klawiatury 20 px
    const uchwyt = page.getByRole("separator", {
      name: "Zmień szerokość kolumny Autor (strzałki w lewo i w prawo)",
    });
    await expect(uchwyt).toHaveAttribute("aria-valuenow", "220");
    await uchwyt.focus();
    const zapis = page.waitForResponse(AKCJA_SERWERA);
    await uchwyt.press("ArrowRight");
    await zapis;
    await expect(uchwyt).toHaveAttribute("aria-valuenow", "240");

    await page.reload();
    await expect(uchwyt).toHaveAttribute("aria-valuenow", "240");
  });

  test("karty: „Dodaj kartę” → „Czytam teraz” widoczna po przeładowaniu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Szablon ma już kartę „Czytam teraz”: najpierw ją usuwamy z menu karty
    const karta = page.getByTestId("karta").filter({ hasText: "Czytam teraz" });
    await expect(karta).toHaveCount(1);
    await karta.hover();
    await karta.getByRole("button", { name: "Menu karty" }).click();
    const usuniecie = page.waitForResponse(AKCJA_SERWERA);
    await page
      .getByRole("menu", { name: "Menu karty" })
      .getByRole("menuitem", { name: "Usuń kartę" })
      .click();
    await usuniecie;
    await expect(karta).toHaveCount(0);

    // „Dodaj kartę” → kolumna Status, „Liczba wierszy z opcją”, opcja Czytam, napis
    await page.getByRole("button", { name: "Dodaj kartę", exact: true }).click();
    const okno = page.getByRole("dialog", { name: "Nowa karta" });
    await expect(okno).toBeVisible();
    await okno
      .getByRole("radiogroup", { name: "Kolumna" })
      .getByRole("radio", { name: "Status" })
      .click();
    await okno
      .getByRole("radiogroup", { name: "Co policzyć" })
      .getByRole("radio", { name: /Liczba wierszy z opcją/ })
      .click();
    await okno
      .getByRole("radiogroup", { name: "Opcja" })
      .getByRole("radio", { name: "Czytam", exact: true })
      .click();
    await okno.getByRole("textbox", { name: "Napis" }).fill("Czytam teraz");
    await expect(okno.getByTestId("podglad-karty")).toHaveText(
      /Czytam teraz\s*0/,
    );
    const dodanie = page.waitForResponse(AKCJA_SERWERA);
    await okno.getByRole("button", { name: "Dodaj kartę", exact: true }).click();
    await dodanie;
    await expect(okno).toHaveCount(0);
    await expect(karta).toHaveText(/Czytam teraz\s*0/);

    await page.reload();
    await expect(karta).toHaveText(/Czytam teraz\s*0/);
  });

  test("„Nowa strona” w pasku bocznym otwiera okno wyboru szablonu", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);

    await page
      .getByRole("navigation", { name: "Główna nawigacja", exact: true })
      .getByRole("link", { name: "Nowa strona", exact: true })
      .click();
    await expect(page).toHaveURL(/\/strony\/nowa$/);
    const okno = page.getByRole("dialog", { name: "Nowa strona" });
    await expect(okno).toBeVisible();
    // S2NewPage: karty szablonów po polsku (radio), domyślnie Pusta strona
    await expect(
      okno.getByRole("radio", { name: /^Książki/ }),
    ).toBeVisible();
    await expect(
      okno.getByRole("radio", { name: /^Pusta strona/ }),
    ).toHaveAttribute("aria-checked", "true");
    await expect(
      okno.getByRole("button", { name: "Utwórz stronę" }),
    ).toBeVisible();
  });

  test("edytor: tabela z „/tab”, zmiana typu kolumny Status → Tekst → Liczba, stopka sumy", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    const userId = await zalozKontoStron(page, info.project.name);

    // Pusta strona edytora (na webie „Nowa strona” prowadzi do wyboru szablonu)
    const idStrony = await zasiejPustaStrone(userId, "Plan");
    await page.goto(`/strony/${idStrony}`);
    await expect(page.getByLabel("Nazwa strony")).toHaveValue("Plan");

    await page.getByRole("combobox", { name: "Nowy blok" }).fill("/tab");
    await page.getByRole("combobox", { name: "Nowy blok" }).press("Enter");
    await expect(page.getByRole("group", { name: "Zapisane widoki" })).toBeVisible();

    // Kolumny pojawiają się po odpowiedzi serwera (do tego czasu blok ma tymczasowe id):
    // zaznaczanie, „#”, 3 pola + nagłówek z przyciskiem „+” (Dodaj kolumnę)
    await expect(page.getByRole("columnheader")).toHaveCount(6, {
      timeout: 20_000,
    });
    // Nowa tabela ma dwa puste wiersze
    const wiersze = page.locator("tbody tr:has(input)");
    await expect(wiersze).toHaveCount(2);
    const naglowek = page.getByRole("columnheader");
    const menuKolumny = page.getByRole("dialog", { name: "Kolumna Status" });

    // Status → Tekst przez menu kolumny („Typ”): puste wiersze, więc bez potwierdzenia i bez strat
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await menuKolumny.getByRole("menuitem", { name: /^Typ:/ }).click();
    const zmianaNaTekst = page.waitForResponse(AKCJA_SERWERA);
    await page
      .getByRole("menu", { name: "Typ pola" })
      .getByRole("menuitem", { name: "Tekst", exact: true })
      .click();
    await zmianaNaTekst;
    await expect(
      page.getByRole("dialog", { name: "Zmienić typ pola?" }),
    ).toHaveCount(0);
    await expect(menuKolumny).toHaveCount(0);

    // „Nowy wiersz” → trzeci wiersz; w jego komórce Status wpisujemy „5” i Enter
    await page.getByRole("button", { name: "Nowy wiersz", exact: true }).last().click();
    await expect(wiersze).toHaveCount(3);
    const komorka = wiersze
      .nth(2)
      .getByRole("textbox", { name: "Status", exact: true });
    const zapisKomorki = page.waitForResponse(AKCJA_SERWERA);
    await komorka.fill("5");
    await komorka.press("Enter");
    await zapisKomorki;
    await expect(komorka).toHaveValue("5");

    // Typ Liczba, podsumowanie „Suma” → stopka pokazuje 5
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await menuKolumny.getByRole("menuitem", { name: /^Typ:/ }).click();
    const zmianaNaLiczbe = page.waitForResponse(AKCJA_SERWERA);
    await page
      .getByRole("menu", { name: "Typ pola" })
      .getByRole("menuitem", { name: "Liczba", exact: true })
      .click();
    await zmianaNaLiczbe;
    await expect(menuKolumny).toHaveCount(0);
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await menuKolumny.getByRole("menuitem", { name: /^Podsumowanie/ }).click();
    await page
      .getByRole("menu", { name: "Podsumowanie" })
      .getByRole("menuitem", { name: "Suma", exact: true })
      .click();
    await expect(
      page.locator("tfoot").getByRole("cell", { name: "5", exact: true }),
    ).toBeVisible();
  });

  test("ikona strony: menu strony w pasku → „Zmień ikonę” → „rakieta” → rocket → ikona w sidebarze", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Ikona z szablonu Książki to book-open; wybieramy rakietę z wyszukiwarki ikon w menu strony paska (S2PageMenu)
    const wSidebarze = page.getByRole("link", { name: "Książki", exact: true });
    await expect(wSidebarze.locator("svg.lucide-book-open")).toBeVisible();
    await page.getByRole("button", { name: "Menu strony Książki", exact: true }).click();
    await page.getByRole("menuitem", { name: "Zmień ikonę" }).click();
    await page.getByRole("textbox", { name: "Szukaj ikony" }).fill("rakieta");
    await page.getByRole("button", { name: "rocket", exact: true }).click();

    // Zapis `lucide:rocket` widać po odświeżeniu: ikona ładuje się dynamicznie
    await expect(wSidebarze.locator("svg.lucide-rocket")).toBeVisible();
    await page.reload();
    await expect(wSidebarze.locator("svg.lucide-rocket")).toBeVisible();
  });

  test("kosz: usunięcie strony → znika z sidebaru → Ustawienia → Kosz → Przywróć → wraca", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    const wSidebarze = page.getByRole("link", { name: "Książki", exact: true });
    await expect(wSidebarze).toBeVisible();
    // Menu strony „⋯” jest w pasku bocznym (S2PageMenu)
    await page.getByRole("button", { name: "Menu strony Książki", exact: true }).click();
    await page.getByRole("menuitem", { name: "Usuń stronę" }).click();
    const potwierdzenie = page.getByRole("alertdialog", { name: /Usunąć stronę/ });
    await expect(potwierdzenie).toBeVisible();
    await potwierdzenie
      .getByRole("button", { name: "Usuń", exact: true })
      .click();
    await expect(wSidebarze).toHaveCount(0);

    await page.goto("/ustawienia/ogolne");
    await page.getByRole("link", { name: "Otwórz kosz (1)" }).click();
    await expect(page).toHaveURL(/\/ustawienia\/kosz$/);
    const pozycja = page.getByRole("listitem", { name: "Książki" }).filter({ visible: true });
    await expect(pozycja).toContainText("zostało 30 dni");
    await pozycja.getByRole("button", { name: "Przywróć" }).click();
    await expect(page.getByText("Kosz jest pusty.")).toBeVisible();

    await page.goto("/strony/nowa");
    await expect(wSidebarze).toBeVisible();

    // Ponownie do kosza i „Usuń na zawsze”
    await page.getByRole("button", { name: "Menu strony Książki", exact: true }).click();
    await page.getByRole("menuitem", { name: "Usuń stronę" }).click();
    await potwierdzenie.getByRole("button", { name: "Usuń", exact: true }).click();
    await expect(wSidebarze).toHaveCount(0);
    await page.goto("/ustawienia/kosz");
    await pozycja.getByRole("button", { name: "Usuń na zawsze" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Usuń na zawsze" }).click();
    await expect(page.getByText("Usunięto na zawsze „Książki”.")).toBeVisible();
    await page.reload();
    await expect(page.getByText("Kosz jest pusty.")).toBeVisible();
  });

  // CMSubs i CMRowEdit (Subscriptions): ekran telefonu z tego samego magazynu co tabela, nowy wiersz w arkuszu
  test("telefon 390 px: Subscriptions — ekran CMSubs, wiersz dodany w arkuszu (kwota, cykl, data), suma w karcie „Miesięcznie”", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
    await zalozKontoStron(page, info.project.name);
    await utworzSubscriptions(page);

    await expect(page.getByRole("heading", { name: "Subskrypcje", level: 1 })).toBeVisible();
    // Dwa układy są w DOM, więc zawężamy do widocznych
    const miesiecznie = page.getByText("Miesięcznie", { exact: true }).filter({ visible: true }).locator("..");
    await expect(miesiecznie).toContainText("0,00 zł");
    await expect(page.getByText("Brak odnowień").filter({ visible: true })).toBeVisible();

    await page.getByRole("button", { name: "Nowy wiersz" }).filter({ visible: true }).click();
    const arkusz = page.getByRole("dialog", { name: "Nowy wiersz" });
    await arkusz.getByRole("textbox", { name: "Nazwa", exact: true }).fill("Netflix");
    await arkusz.getByRole("textbox", { name: "Kwota cykliczna", exact: true }).fill("43,5");
    // Data odnowienia: piętnasty dzień następnego miesiąca (kalendarz otwiera się na bieżącym miesiącu)
    const data = arkusz.getByRole("group", { name: "Data odnowienia" });
    await data.getByRole("button", { name: "Następny miesiąc" }).click();
    await data.getByRole("button", { name: /^15 \D+ \d{4}$/ }).click();
    await arkusz.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(arkusz).toBeHidden();

    // Wiersz na liście i suma w karcie
    const wiersz = page.getByRole("button", { name: /Netflix/ }).filter({ visible: true });
    await expect(wiersz).toContainText("43,50 zł/m");
    await expect(miesiecznie).toContainText("43,50 zł");
    await expect(page.getByText("1 z 1 subskrypcji").filter({ visible: true })).toBeVisible();

    // Cykl „rok” w arkuszu: 43,50 zł rocznie to 3,63 zł miesięcznie (zaokrąglone do grosza)
    await wiersz.click();
    const edycja = page.getByRole("dialog", { name: "Netflix" });
    await edycja.getByRole("radio", { name: "rok" }).click();
    await edycja.getByRole("button", { name: "Zapisz", exact: true }).click();
    await expect(edycja).toBeHidden();
    await expect(wiersz).toContainText("43,50 zł/r");
    await expect(miesiecznie).toContainText("3,63 zł");
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
    // „Nowa strona” (nagłówek telefonu) prowadzi do wyboru szablonu; pusty szablon tworzy pustą stronę
    await page.getByRole("link", { name: "Nowa strona" }).first().click();
    await expect(page).toHaveURL(/\/strony\/nowa$/);
    // Telefon: arkusz „Nowa strona” z paskiem „Anuluj · Nowa strona · Utwórz”; domyślnie pusta strona
    await page.getByRole("button", { name: "Utwórz", exact: true }).click();
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
    // Pusta strona bez nazwy to „Bez tytułu” (jak na webie)
    await expect(page.getByRole("link", { name: /Bez tytułu/ }).first()).toBeVisible();
  });
});
