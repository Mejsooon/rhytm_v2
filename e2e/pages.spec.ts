import { expect, test } from "@playwright/test";

import {
  utworzBooks,
  zalozKontoStron,
  zasiejPustaStrone,
} from "./helpers/strony";

// Silnik stron: strona z szablonu Books, edytor z tabelą, kosz i telefon.
// Tabela edytuje się wprost w komórkach; każdy zapis to akcja serwera (POST na adres strony),
// więc po zmianie czekamy na odpowiedź POST, a potem sprawdzamy widok.
test.describe("strony", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("Books z szablonu: wiersz „Czytam” w komórkach, ocena, usunięcie i cofnięcie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // „+ Nowy” zakłada wiersz na serwerze i stawia kursor w komórce tytułu
    const nowy = page.waitForResponse((o) => o.request().method() === "POST");
    await page.getByRole("button", { name: "Nowy", exact: true }).click();
    await nowy;
    const wiersz = page.locator("tbody tr");
    await expect(wiersz).toHaveCount(1);
    const tytul = wiersz.getByRole("textbox", { name: "Tytuł", exact: true });
    await expect(tytul).toBeFocused();

    // Tytuł: wpis i Enter (zapis od razu, bez czekania 600 ms)
    const zapisTytulu = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await tytul.fill("Diuna");
    await tytul.press("Enter");
    await zapisTytulu;
    await expect(tytul).toHaveValue("Diuna");
    await expect(tytul).not.toBeFocused();

    // Status: okienko opcji → „Szukaj lub dodaj opcję” → wybór „Czytam”
    const status = wiersz.getByRole("button", { name: "Status", exact: true });
    await status.click();
    await page
      .getByRole("textbox", { name: "Szukaj lub dodaj opcję" })
      .fill("Czyt");
    const zapisStatusu = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await page.getByRole("option", { name: "Czytam", exact: true }).click();
    await zapisStatusu;
    await expect(status).toHaveText("Czytam");

    // Karta „Czytam teraz” liczy się na żywo
    const karta = page.getByTestId("karta").filter({ hasText: "Czytam teraz" });
    await expect(karta).toHaveText(/Czytam teraz\s*1/);

    // Ocena: czwarta gwiazdka w komórce
    const gwiazdka = wiersz.getByRole("button", { name: "Ocena 4 na 5" });
    const zapisOceny = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await gwiazdka.click();
    await zapisOceny;
    await expect(gwiazdka).toHaveAttribute("aria-pressed", "true");
    await expect(
      wiersz.getByRole("button", { name: "Ocena 5 na 5" }),
    ).toHaveAttribute("aria-pressed", "false");

    // Kosz „Usuń wiersz” → wiersz znika, „Cofnij” → wraca z tytułem i statusem
    await wiersz.hover();
    const usuniecie = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await wiersz.getByRole("button", { name: "Usuń wiersz" }).click();
    await usuniecie;
    await expect(wiersz).toHaveCount(0);
    await expect(karta).toHaveText(/Czytam teraz\s*0/);
    const przywrocenie = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Cofnij" }).click();
    await przywrocenie;
    await expect(wiersz).toHaveCount(1);
    await expect(tytul).toHaveValue("Diuna");
    await expect(status).toHaveText("Czytam");
    await expect(karta).toHaveText(/Czytam teraz\s*1/);
  });

  test("opcje z komórki: utworzenie „Porzucone”, zmiana koloru i usunięcie", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    const nowy = page.waitForResponse((o) => o.request().method() === "POST");
    await page.getByRole("button", { name: "Nowy", exact: true }).click();
    await nowy;
    const wiersz = page.locator("tbody tr");
    await expect(wiersz).toHaveCount(1);

    // Nowa opcja z wpisanego tekstu: zapis pola, potem zapis komórki (dwa POST-y po kolei)
    const status = wiersz.getByRole("button", { name: "Status", exact: true });
    await status.click();
    await page
      .getByRole("textbox", { name: "Szukaj lub dodaj opcję" })
      .fill("Porzucone");
    let doUtworzenia = 2;
    const utworzenie = page.waitForResponse(
      (o) => o.request().method() === "POST" && --doUtworzenia === 0,
    );
    await page.getByRole("button", { name: "Utwórz «Porzucone»" }).click();
    await utworzenie;

    // Opcja jest na liście; wybieramy ją ręcznie (samoczynny wybór po „Utwórz” sprawdza osobny test niżej)
    await status.click();
    const opcja = page.getByRole("option", { name: "Porzucone", exact: true });
    await expect(opcja).toBeVisible();
    const wybor = page.waitForResponse((o) => o.request().method() === "POST");
    await opcja.click();
    await wybor;
    await expect(status).toHaveText("Porzucone");

    // „⋯” przy opcji → panel „Edycja opcji” → kolor Czerwony
    await status.click();
    await opcja.hover();
    await page.getByRole("button", { name: "Opcje: Porzucone" }).click();
    const panel = page.getByRole("group", { name: "Edycja opcji" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("textbox", { name: "Nazwa opcji" })).toHaveValue(
      "Porzucone",
    );
    // Nowa opcja jest szara
    await expect(
      panel.getByRole("button", { name: "Szary", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    const zapisKoloru = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await panel.getByRole("button", { name: "Czerwony", exact: true }).click();
    await zapisKoloru;
    await expect(
      panel.getByRole("button", { name: "Czerwony", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");

    // „Usuń opcję”: czyści komórkę i zapisuje pole (dwa POST-y równolegle), panel wraca do listy
    let doUsuniecia = 2;
    const usuniecie = page.waitForResponse(
      (o) => o.request().method() === "POST" && --doUsuniecia === 0,
    );
    await panel.getByRole("button", { name: "Usuń opcję" }).click();
    await usuniecie;
    await expect(panel).toHaveCount(0);
    await expect(opcja).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(status).toHaveText("—");

    // Po przeładowaniu opcji nadal nie ma, a pozostałe są
    await page.reload();
    await expect(wiersz).toHaveCount(1);
    await status.click();
    await expect(
      page.getByRole("option", { name: "Czytam", exact: true }),
    ).toBeVisible();
    await expect(opcja).toHaveCount(0);
  });

  test("„Utwórz «nazwa»” w komórce od razu wybiera nową opcję", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    const nowy = page.waitForResponse((o) => o.request().method() === "POST");
    await page.getByRole("button", { name: "Nowy", exact: true }).click();
    await nowy;
    const status = page
      .locator("tbody tr")
      .getByRole("button", { name: "Status", exact: true });
    await expect(status).toHaveText("Chcę przeczytać");
    await status.click();
    await page
      .getByRole("textbox", { name: "Szukaj lub dodaj opcję" })
      .fill("Porzucone");
    let doUtworzenia = 2;
    const utworzenie = page.waitForResponse(
      (o) => o.request().method() === "POST" && --doUtworzenia === 0,
    );
    await page.getByRole("button", { name: "Utwórz «Porzucone»" }).click();
    await utworzenie;
    await expect(status).toHaveText("Porzucone");
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
    const zapis = page.waitForResponse((o) => o.request().method() === "POST");
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
    const usuniecie = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
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
    const dodanie = page.waitForResponse((o) => o.request().method() === "POST");
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
      .getByRole("navigation", { name: "Główna nawigacja" })
      .getByRole("link", { name: "Nowa strona", exact: true })
      .click();
    await expect(page).toHaveURL(/\/strony\/nowa$/);
    const okno = page.getByRole("dialog", { name: "Nowa strona" });
    await expect(okno).toBeVisible();
    await expect(
      okno.getByRole("button", { name: /^Books/ }),
    ).toBeVisible();
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
    await expect(page.getByLabel("Nazwa tabeli")).toBeVisible();

    // Kolumny pojawiają się po odpowiedzi serwera (do tego czasu blok ma tymczasowe id):
    // 3 pola + nagłówek z przyciskiem „+” (Dodaj kolumnę)
    await expect(page.getByRole("columnheader")).toHaveCount(4, {
      timeout: 20_000,
    });
    // Nowa tabela ma dwa puste wiersze
    const wiersze = page.locator("tbody tr");
    await expect(wiersze).toHaveCount(2);
    const naglowek = page.getByRole("columnheader");
    const menuKolumny = page.getByRole("dialog", { name: "Kolumna Status" });

    // Status → Tekst przez menu kolumny („Typ”): puste wiersze, więc bez potwierdzenia i bez strat
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await menuKolumny.getByRole("menuitem", { name: /^Typ:/ }).click();
    const zmianaNaTekst = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await page
      .getByRole("menu", { name: "Typ pola" })
      .getByRole("menuitem", { name: "Tekst", exact: true })
      .click();
    await zmianaNaTekst;
    await expect(
      page.getByRole("dialog", { name: "Zmienić typ pola?" }),
    ).toHaveCount(0);
    await expect(menuKolumny).toHaveCount(0);

    // „+ Nowy” → trzeci wiersz; w jego komórce Status wpisujemy „5” i Enter
    const nowy = page.waitForResponse((o) => o.request().method() === "POST");
    await page.getByRole("button", { name: "Nowy", exact: true }).click();
    await nowy;
    await expect(wiersze).toHaveCount(3);
    const komorka = wiersze
      .nth(2)
      .getByRole("textbox", { name: "Status", exact: true });
    const zapisKomorki = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
    await komorka.fill("5");
    await komorka.press("Enter");
    await zapisKomorki;
    await expect(komorka).toHaveValue("5");

    // Typ Liczba, podsumowanie „Suma” → stopka pokazuje 5
    await naglowek.getByRole("button", { name: "Status", exact: true }).click();
    await menuKolumny.getByRole("menuitem", { name: /^Typ:/ }).click();
    const zmianaNaLiczbe = page.waitForResponse(
      (o) => o.request().method() === "POST",
    );
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

  test("ikona strony: „Zmień ikonę” → „rakieta” → rocket → ikona w sidebarze", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    await zalozKontoStron(page, info.project.name);
    await utworzBooks(page);

    // Ikona z szablonu Books to book-open; wybieramy rakietę z wyszukiwarki ikon
    const wSidebarze = page.getByRole("link", { name: "Books", exact: true });
    await expect(wSidebarze.locator("svg.lucide-book-open")).toBeVisible();
    await page.getByRole("button", { name: "Zmień ikonę", exact: true }).click();
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

    const wSidebarze = page.getByRole("link", { name: "Books", exact: true });
    await expect(wSidebarze).toBeVisible();
    await page.getByRole("button", { name: "Menu strony", exact: true }).click();
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
