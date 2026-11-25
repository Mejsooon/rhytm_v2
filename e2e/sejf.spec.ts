import { randomBytes } from "node:crypto";

import { expect, test, type Response } from "@playwright/test";

import { zalozKontoStron } from "./helpers/strony";

// Odpowiedź akcji serwera Next: POST z nagłówkiem next-action (zapis komórki)
const AKCJA_SERWERA = (o: Response) =>
  o.request().method() === "POST" &&
  o.request().headers()["next-action"] !== undefined;

// Sejf zero-knowledge w module Hasła (/hasla): przepływ od ustawienia do resetu, z kontrolą,
// że hasła nie opuszczają przeglądarki.
test.describe("sejf", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("Hasła: ustawienie, zapis w komórkach, oczko, kopiowanie, blokada, odblokowanie i reset — bez haseł w żądaniach", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    // PBKDF2 600 000 iteracji ×3 (ustawienie, odblokowanie, ponowne ustawienie) + zapisy
    test.setTimeout(120_000);

    // Unikalne hasła; hasło sekretu ma polskie znaki i znaki zmieniane przez kodowanie URL,
    // więc sprawdzamy też formy zakodowane (URL, JSON, \uXXXX)
    const sufiks = randomBytes(6).toString("hex");
    const haslo = `żółw-Tajne!${sufiks}&zbyt Dlugie-7`;
    const glowne = `Glowne-${sufiks}-Kl3ucz!Dluuugie`;
    const noweGlowne = `Nowe-${sufiks}-Gl0wne!Dluuugie`;
    const zlyGlowne = `Zle-${sufiks}-Haslo!Dluuugie9`;
    const serwis = `Serwis-${sufiks}`;
    const login = `login-${sufiks}`;
    const notatka = `notatka-Tajna!${sufiks}`;
    const zakazane = [haslo, notatka, glowne, noweGlowne, zlyGlowne].flatMap(
      (h) => [
        h,
        encodeURIComponent(h),
        encodeURI(h),
        JSON.stringify(h).slice(1, -1),
        h.replace(
          /[^\x00-\x7f]/g,
          (z) => `\\u${z.charCodeAt(0).toString(16).padStart(4, "0")}`,
        ),
      ],
    );

    // Schowek (Chromium) do sprawdzenia „Kopiuj hasło”
    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    // Wszystkie żądania z całego testu: adres, nagłówki i treść (także binarna)
    const zadania: {
      url: string;
      metoda: string;
      naglowki: string;
      tresc: string;
    }[] = [];
    page.on("request", (zadanie) => {
      const bufor = zadanie.postDataBuffer();
      zadania.push({
        url: zadanie.url(),
        metoda: zadanie.method(),
        naglowki: JSON.stringify(zadanie.headers()),
        tresc: bufor ? bufor.toString("utf8") + bufor.toString("latin1") : "",
      });
    });
    function sprawdzZadania() {
      for (const z of zadania) {
        for (const h of zakazane) {
          expect(z.url, `adres ${z.url} zawiera hasło`).not.toContain(h);
          expect(
            z.naglowki,
            `nagłówki ${z.metoda} ${z.url} zawierają hasło`,
          ).not.toContain(h);
          expect(
            z.tresc,
            `treść ${z.metoda} ${z.url} zawiera hasło`,
          ).not.toContain(h);
        }
      }
    }
    // Trwałe magazyny przeglądarki (localStorage, sessionStorage, cookie) nie mają żadnego z haseł
    async function sprawdzMagazyny() {
      const magazyny = await page.evaluate(() =>
        JSON.stringify({
          local: Object.entries(localStorage),
          session: Object.entries(sessionStorage),
        }),
      );
      const ciasteczka = JSON.stringify(await page.context().cookies());
      for (const h of zakazane) {
        expect(
          magazyny,
          "localStorage/sessionStorage zawiera hasło",
        ).not.toContain(h);
        expect(ciasteczka, "cookie zawiera hasło").not.toContain(h);
      }
    }

    await zalozKontoStron(page, info.project.name);

    // Moduł Hasła: nagłówek z plakietkami, jeszcze bez sejfu
    await page.goto("/hasla");
    await expect(
      page.getByRole("heading", { name: "Hasła", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText("Szyfrowane", { exact: true })).toBeVisible();
    await expect(page.getByText("0 haseł", { exact: true })).toBeVisible();

    // Ustawienie sejfu: miernik siły, zgoda, „Utwórz sejf”
    const ustawianie = page.getByRole("form", {
      name: "Ustaw hasło główne sejfu",
    });
    await expect(ustawianie).toBeVisible();
    await expect(
      ustawianie.getByRole("button", { name: "Utwórz sejf" }),
    ).toBeDisabled();
    await ustawianie.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await expect(ustawianie.getByText(/^(Mocne|Bardzo mocne)$/)).toBeVisible();
    await ustawianie.getByLabel("Powtórz", { exact: true }).fill(`${glowne}x`);
    await expect(ustawianie.getByText("Hasła się różnią.")).toBeVisible();
    await ustawianie.getByLabel("Powtórz", { exact: true }).fill(glowne);
    await expect(ustawianie.getByText("Hasła się różnią.")).toHaveCount(0);
    await ustawianie
      .getByRole("checkbox", {
        name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać.",
      })
      .click();
    await ustawianie.getByRole("button", { name: "Utwórz sejf" }).click();
    await expect(
      page.getByText("Sejf odblokowany", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    sprawdzZadania();

    // Kategorie: dymek „Opcje kategorii” → nowa kategoria „Bank”
    await page.getByRole("button", { name: "Kategorie", exact: true }).click();
    await page.getByRole("textbox", { name: "Nowa kategoria" }).fill("Bank");
    const zapisKategorii = page.waitForResponse(AKCJA_SERWERA);
    await page.getByRole("button", { name: "Dodaj", exact: true }).click();
    await zapisKategorii;
    await expect(
      page.getByRole("list", { name: "Kategorie haseł" }).getByText("Bank"),
    ).toBeVisible();
    await page.keyboard.press("Escape");

    // „+ Nowy” zakłada wiersz na serwerze; kursor trafia do komórki Serwis
    await page.getByRole("button", { name: "Nowy", exact: true }).click();
    const wiersz = page.locator("tbody tr");
    await expect(wiersz).toHaveCount(1);
    await expect(page.getByText("1 hasło", { exact: true })).toBeVisible();
    const komorkaSerwis = wiersz.getByRole("textbox", {
      name: "Serwis",
      exact: true,
    });
    await expect(komorkaSerwis).toBeFocused();

    // Serwis i Login: wpis i Enter (zapis od razu)
    const zapisSerwisu = page.waitForResponse(AKCJA_SERWERA);
    await komorkaSerwis.fill(serwis);
    await komorkaSerwis.press("Enter");
    await zapisSerwisu;
    const komorkaLogin = wiersz.getByRole("textbox", {
      name: "Login",
      exact: true,
    });
    const zapisLoginu = page.waitForResponse(AKCJA_SERWERA);
    await komorkaLogin.fill(login);
    await komorkaLogin.press("Enter");
    await zapisLoginu;

    // Hasło i Notatka (Sekret): klik w komórkę → pole → Enter szyfruje i wysyła szyfrogram
    for (const [nazwa, tekst] of [
      ["Hasło", haslo],
      ["Notatka", notatka],
    ] as const) {
      await wiersz.getByRole("button", { name: `${nazwa}: puste` }).click();
      const pole = wiersz.getByRole("textbox", { name: nazwa, exact: true });
      await pole.fill(tekst);
      const zapisSekretu = page.waitForResponse(AKCJA_SERWERA);
      await pole.press("Enter");
      await zapisSekretu;
      await expect(
        wiersz.getByRole("button", { name: `${nazwa}: zaszyfrowane` }),
      ).toBeVisible();
    }
    await expect(wiersz.getByText("••••••••••••").first()).toBeVisible();

    // Kategoria z „Kategorie”: okienko opcji → „Bank”
    await wiersz.getByRole("button", { name: /^Kategoria: / }).click();
    const zapisWyboru = page.waitForResponse(AKCJA_SERWERA);
    await page.getByRole("option", { name: "Bank", exact: true }).click();
    await zapisWyboru;
    await expect(
      wiersz.getByRole("button", { name: "Kategoria: Bank" }),
    ).toBeVisible();
    await page.waitForLoadState("networkidle");
    sprawdzZadania();

    // Oczko odsłania hasło i notatkę wiersza, ponowny klik ukrywa
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    await expect(wiersz.getByText(notatka, { exact: true })).toBeVisible();
    await wiersz.getByRole("button", { name: "Ukryj hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toHaveCount(0);

    // „Kopiuj hasło”: jawny tekst trafia do schowka, toast mówi o czyszczeniu
    await wiersz.getByRole("button", { name: "Kopiuj hasło" }).click();
    await expect(page.getByText("Schowek wyczyści się za 30 s.")).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      haslo,
    );

    // Wyszukiwanie i segment „Kategoria” (stan klienta, bez zapisu), tu przy otwartym sejfie
    const szukaj = page.getByRole("textbox", { name: "Szukaj", exact: true });
    await szukaj.fill("nie-ma-takiego-serwisu");
    await expect(wiersz).toHaveCount(0);
    await szukaj.fill(login.toUpperCase());
    await expect(wiersz).toHaveCount(1);
    await szukaj.fill("");

    // „Zablokuj teraz” → karta odblokowania, hasło i tabela znikają z DOM
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zablokuj teraz" }).click();
    await expect(
      page.getByRole("heading", { name: "Odblokuj sejf" }),
    ).toBeVisible();
    // Ekran telefonu ma dłuższe zdanie z tym fragmentem (oba układy są w DOM), więc tekst dokładny
    await expect(
      page.getByText("Blokada po 5 min bezczynności.", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);
    await expect(page.getByText(notatka, { exact: true })).toHaveCount(0);

    // Zamknięty sejf (S2Vault): tabela widoczna pod rozmyciem, sekrety jako „zablokowane”, okno na środku;
    // klik w komórkę tabeli nic nie robi (treść jest inert pod nakładką)
    await expect(page.locator("table")).toBeVisible();
    await expect(
      page.getByText("zablokowane", { exact: true }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("dialog", { name: "Odblokuj sejf" }),
    ).toBeVisible();
    await expect(page.getByText(serwis, { exact: true })).toBeVisible();
    await page
      .locator("table")
      .getByText("zablokowane", { exact: true })
      .first()
      .click({ force: true });
    await expect(page.locator("table input:focus")).toHaveCount(0);
    await expect(
      page.getByRole("dialog", { name: "Odblokuj sejf" }),
    ).toBeVisible();

    // Odblokowanie: najpierw puste pole, potem złe hasło, potem dobre
    const karta = page.getByRole("dialog", { name: "Odblokuj sejf" });
    await expect(karta).toBeVisible();
    await karta.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(karta.getByText("Wpisz hasło główne.")).toBeVisible();
    await karta.getByLabel("Hasło główne", { exact: true }).fill(zlyGlowne);
    await karta.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(karta.getByText("Nieprawidłowe hasło główne.")).toBeVisible({
      timeout: 20_000,
    });
    await expect(
      page.getByRole("heading", { name: "Odblokuj sejf" }),
    ).toBeVisible();
    await karta.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await karta.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(
      page.getByText("Sejf odblokowany", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(karta).toHaveCount(0);

    // Po odblokowaniu tabela wraca z wierszem dodanym w tej sesji; segment „Kategoria” zawęża po jawnej kolumnie
    await expect(wiersz).toHaveCount(1);
    const segment = page.getByRole("group", { name: "Kategoria" });
    await segment.getByRole("button", { name: "Bank", exact: true }).click();
    await expect(
      segment.getByRole("button", { name: "Bank", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(wiersz).toHaveCount(1);
    await szukaj.fill("nie-ma-takiego-serwisu");
    await expect(wiersz).toHaveCount(0);
    await szukaj.fill(serwis.toLowerCase());
    await expect(wiersz).toHaveCount(1);
    await segment.getByRole("button", { name: "Wszystkie", exact: true }).click();
    await szukaj.fill("");

    // Oczko po ponownym odblokowaniu
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    sprawdzZadania();
    await sprawdzMagazyny();

    // Reset w Ustawienia → Sejf (po przeładowaniu sejf jest zablokowany; reset działa też zablokowany)
    await page.goto("/ustawienia/sejf");
    // „Sejf” jest nagłówkiem w topbarze, zakładce i karcie — czekamy na stan karty
    await expect(page.getByText("Zablokowany", { exact: true })).toBeVisible();
    await page
      .getByRole("button", { name: "Zresetuj sejf", exact: true })
      .click();
    const reset = page.getByRole("dialog", { name: "Zresetować sejf?" });
    await expect(reset).toBeVisible();
    await expect(
      reset.getByText("Tej operacji nie da się cofnąć."),
    ).toBeVisible();
    await expect(reset.getByText("Zostanie usunięte")).toBeVisible();
    // Dwa niepuste sekrety: hasło i notatka
    await expect(reset.getByText("2 sekrety", { exact: true })).toBeVisible();
    await expect(reset.getByText("serwisy, loginy, URL-e")).toBeVisible();
    // Bez wpisanego słowa przycisk resetu jest nieaktywny
    await expect(
      reset.getByRole("button", { name: "Zresetuj sejf", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    await reset.getByPlaceholder("RESETUJ").fill("RESETUJ");
    await reset
      .getByRole("button", { name: "Zresetuj sejf", exact: true })
      .click();
    await expect(reset).toHaveCount(0);
    await expect(page.getByText("Nie ustawiony")).toBeVisible({
      timeout: 20_000,
    });

    // Moduł Hasła po resecie: wiersz zostaje, sekrety są puste, a sejf trzeba ustawić od nowa
    await page.goto("/hasla");
    const nowe = page.getByRole("form", { name: "Ustaw hasło główne sejfu" });
    await expect(nowe).toBeVisible();
    await nowe.getByLabel("Hasło główne", { exact: true }).fill(noweGlowne);
    await nowe.getByLabel("Powtórz", { exact: true }).fill(noweGlowne);
    await nowe
      .getByRole("checkbox", {
        name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać.",
      })
      .click();
    await nowe.getByRole("button", { name: "Utwórz sejf" }).click();
    await expect(
      page.getByText("Sejf odblokowany", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(wiersz).toHaveCount(1);
    await expect(
      wiersz.getByRole("textbox", { name: "Serwis", exact: true }),
    ).toHaveValue(serwis);
    await expect(
      wiersz.getByRole("textbox", { name: "Login", exact: true }),
    ).toHaveValue(login);
    await expect(
      wiersz.getByRole("button", { name: "Hasło: puste" }),
    ).toBeVisible();
    await expect(
      wiersz.getByRole("button", { name: "Notatka: puste" }),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);

    // Na końcu: żadne żądanie z całego testu nie niosło żadnego z haseł; sprawdzamy też, że coś w ogóle złapaliśmy
    expect(zadania.filter((z) => z.metoda === "POST").length).toBeGreaterThan(
      0,
    );
    // Dowód, że zapis szyfrogramu przeszedł przez nasłuch: któreś żądanie niesie {"iv": …, "ct": …}
    expect(
      zadania.some((z) => z.tresc.includes('"iv"') && z.tresc.includes('"ct"')),
      "żadne żądanie nie niosło szyfrogramu",
    ).toBe(true);
    sprawdzZadania();
    await sprawdzMagazyny();
  });
  test("Hasła na telefonie: ustawienie, nowe hasło w arkuszu, rozwinięcie, Pokaż/Kopiuj, blokada, odblokowanie i reset — bez haseł w żądaniach", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
    // PBKDF2 600 000 iteracji ×4 (ustawienie, odblokowanie ×2, ponowne ustawienie) + zapisy
    test.setTimeout(150_000);

    const sufiks = randomBytes(6).toString("hex");
    const haslo = `żółw-Tajne!${sufiks}&zbyt Dlugie-7`;
    const glowne = `Glowne-${sufiks}-Kl3ucz!Dluuugie`;
    const noweGlowne = `Nowe-${sufiks}-Gl0wne!Dluuugie`;
    const zlyGlowne = `Zle-${sufiks}-Haslo!Dluuugie9`;
    const serwis = `Serwis-${sufiks}`;
    const login = `login-${sufiks}`;
    const notatka = `notatka-Tajna!${sufiks}`;
    const zakazane = [haslo, notatka, glowne, noweGlowne, zlyGlowne].flatMap(
      (h) => [
        h,
        encodeURIComponent(h),
        encodeURI(h),
        JSON.stringify(h).slice(1, -1),
        h.replace(
          /[^\x00-\x7f]/g,
          (z) => `\\u${z.charCodeAt(0).toString(16).padStart(4, "0")}`,
        ),
      ],
    );

    await page
      .context()
      .grantPermissions(["clipboard-read", "clipboard-write"]);

    // Wszystkie żądania z całego testu (adres, nagłówki, treść): żadne nie niesie jawnego hasła
    const zadania: { url: string; naglowki: string; tresc: string }[] = [];
    page.on("request", (zadanie) => {
      const bufor = zadanie.postDataBuffer();
      zadania.push({
        url: zadanie.url(),
        naglowki: JSON.stringify(zadanie.headers()),
        tresc: bufor ? bufor.toString("utf8") + bufor.toString("latin1") : "",
      });
    });
    function sprawdzZadania() {
      for (const z of zadania) {
        for (const h of zakazane) {
          expect(z.url, `adres ${z.url} zawiera hasło`).not.toContain(h);
          expect(z.naglowki, `nagłówki ${z.url} zawierają hasło`).not.toContain(
            h,
          );
          expect(z.tresc, `treść ${z.url} zawiera hasło`).not.toContain(h);
        }
      }
    }

    await zalozKontoStron(page, info.project.name);

    // Ustawianie sejfu: pełny ekran (CMVaultSetup) z linkiem „Anuluj” do listy stron
    await page.goto("/hasla");
    const ustawianie = page.getByRole("form", {
      name: "Ustaw hasło główne sejfu",
    });
    await expect(ustawianie).toBeVisible();
    await expect(
      ustawianie.getByText("Hasło tylko do sejfu!", { exact: true }),
    ).toBeVisible();
    await expect(
      ustawianie.getByRole("link", { name: "Anuluj" }),
    ).toHaveAttribute("href", "/strony");
    await expect(
      ustawianie.getByRole("button", { name: "Utwórz sejf" }),
    ).toBeDisabled();
    await ustawianie.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await ustawianie.getByLabel("Powtórz", { exact: true }).fill(`${glowne}x`);
    await expect(ustawianie.getByText("Hasła się różnią.")).toBeVisible();
    await ustawianie.getByLabel("Powtórz", { exact: true }).fill(glowne);
    await ustawianie
      .getByRole("checkbox", {
        name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać.",
      })
      .click();
    await ustawianie.getByRole("button", { name: "Utwórz sejf" }).click();

    // Odblokowany: lista z plakietką odliczania (baner webu jest ukryty na telefonie)
    await expect(page.getByText(/^odblokowany · auto-blokada za /).filter({ visible: true })).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(page.getByRole("heading", { name: "Hasła", level: 1 })).toBeVisible();
    await expect(page.getByText("Brak haseł. Dodaj pierwsze przyciskiem +.")).toBeVisible();

    // „Nowe hasło” → arkusz wiersza: Serwis, Login, Hasło i Notatka (sekrety szyfrowane przed wysłaniem)
    await page.getByRole("button", { name: "Nowe hasło" }).click();
    const arkusz = page.getByRole("dialog", { name: "Nowy wiersz" });
    await expect(arkusz).toBeVisible();
    await arkusz.getByLabel("Serwis", { exact: true }).fill(serwis);
    await arkusz.getByLabel("Login", { exact: true }).fill(login);
    await arkusz.getByRole("textbox", { name: "Hasło", exact: true }).fill(haslo);
    await arkusz
      .getByRole("textbox", { name: "Notatka", exact: true })
      .fill(notatka);
    const zapisWiersza = page.waitForResponse(AKCJA_SERWERA);
    await arkusz.getByRole("button", { name: "Zapisz" }).click();
    await zapisWiersza;
    await expect(arkusz).toHaveCount(0);

    // Lista: wiersz zwinięty; po rozwinięciu hasło i notatka pod maską, nic nie jest w DOM jako tekst jawny
    const wiersz = page.getByRole("button", { name: new RegExp(serwis) });
    await expect(wiersz).toHaveAttribute("aria-expanded", "false");
    await page.waitForLoadState("networkidle");
    await wiersz.click();
    await expect(wiersz).toHaveAttribute("aria-expanded", "true");
    // Układ webu jest w DOM (display:none na telefonie): getByText/getByLabel widzą też jego elementy,
    // więc w tym teście zawężamy do widocznych. Tutaj: tylko widoczne maski (tabela webu też je ma)
    await expect(page.getByText("••••••••••").filter({ visible: true })).toHaveCount(2);
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);
    await expect(page.getByText(notatka, { exact: true })).toHaveCount(0);

    // „Pokaż hasło” / „Ukryj hasło” i „Pokaż notatkę”
    await page.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(page.getByText(haslo, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Ukryj hasło" }).click();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);
    await page.getByRole("button", { name: "Pokaż notatkę" }).click();
    await expect(page.getByText(notatka, { exact: true })).toBeVisible();

    // „Kopiuj hasło”: schowek ma hasło, pod polem dopisek o czyszczeniu; hasło nie pojawia się na ekranie
    await page.getByRole("button", { name: "Kopiuj hasło" }).click();
    await expect(
      page.getByText("Skopiowano · schowek wyczyści się za 30 s"),
    ).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(
      haslo,
    );
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);

    // Zwinięcie czyści odsłoniętą notatkę
    await wiersz.click();
    await expect(wiersz).toHaveAttribute("aria-expanded", "false");
    await expect(page.getByText(notatka, { exact: true })).toHaveCount(0);

    // „Edytuj”: arkusz z polem Hasło „zaszyfrowane” (puste), odszyfrowanie dopiero po fokusie
    await wiersz.click();
    await page.getByRole("button", { name: "Edytuj", exact: true }).click();
    const edycja = page.getByRole("dialog", { name: serwis });
    await expect(edycja).toBeVisible();
    const poleHasla = edycja.getByRole("textbox", { name: "Hasło", exact: true });
    await expect(poleHasla).toHaveValue("");
    await expect(poleHasla).toHaveAttribute("placeholder", "zaszyfrowane");
    await poleHasla.click();
    await expect(poleHasla).toHaveValue(haslo);
    await edycja.getByRole("button", { name: "Anuluj" }).click();
    await expect(edycja).toHaveCount(0);

    // Wyszukiwanie po Loginie i chipy Kategorii (stan klienta, bez zapisu)
    const szukaj = page.getByRole("searchbox", { name: "Szukaj haseł" });
    await szukaj.fill("nie-ma-takiego-serwisu");
    await expect(page.getByText("Nic nie znaleziono.")).toBeVisible();
    await szukaj.fill(login.toUpperCase());
    await expect(wiersz).toBeVisible();
    await szukaj.fill("");
    await page.waitForLoadState("networkidle");
    sprawdzZadania();

    // Odsłoń hasło i zablokuj sejf: pełny ekran „Sejf jest zablokowany”, jawnego tekstu już nie ma
    await wiersz.click();
    await page.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(page.getByText(haslo, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zablokuj sejf" }).click();
    await expect(
      page.getByRole("heading", { name: "Sejf jest zablokowany", level: 1 }),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);
    await expect(page.getByText(notatka, { exact: true })).toHaveCount(0);
    await expect(page.getByText("Odblokuj biometrią")).toHaveCount(0);

    // Odblokowanie: puste pole, złe hasło, dobre hasło
    await page.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(
      page.getByText("Wpisz hasło główne.", { exact: true }).filter({ visible: true }),
    ).toBeVisible();
    await page.getByLabel("Hasło główne", { exact: true }).filter({ visible: true }).fill(zlyGlowne);
    await page.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(page.getByText("Nieprawidłowe hasło główne.").filter({ visible: true })).toBeVisible({
      timeout: 20_000,
    });
    await page.getByLabel("Hasło główne", { exact: true }).filter({ visible: true }).fill(glowne);
    await page.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(page.getByText(/^odblokowany · auto-blokada za /).filter({ visible: true })).toBeVisible(
      { timeout: 20_000 },
    );
    await expect(wiersz).toBeVisible();
    sprawdzZadania();

    // Reset z ekranu blokady: arkusz „Zresetować sejf?” z liczbą sekretów (hasło i notatka)
    await page.getByRole("button", { name: "Zablokuj sejf" }).click();
    await page
      .getByRole("button", { name: "Nie pamiętam hasła — zresetuj sejf" })
      .click();
    const reset = page.getByRole("dialog", { name: "Zresetować sejf?" });
    await expect(reset).toBeVisible();
    await expect(
      reset.getByText("Tej operacji nie da się cofnąć."),
    ).toBeVisible();
    await expect(reset.getByText("2 sekrety", { exact: true })).toBeVisible();
    await expect(reset.getByText("serwisy, loginy, URL-e")).toBeVisible();
    await expect(
      reset.getByRole("button", { name: "Zresetuj sejf", exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    await reset.getByPlaceholder("RESETUJ").fill("RESETUJ");
    await reset
      .getByRole("button", { name: "Zresetuj sejf", exact: true })
      .click();
    await expect(reset).toHaveCount(0);

    // Po resecie sejf trzeba ustawić od nowa (ekran ustawiania); wiersz zostaje, sekrety są puste
    const nowe = page.getByRole("form", { name: "Ustaw hasło główne sejfu" });
    await expect(nowe).toBeVisible({ timeout: 20_000 });
    await nowe.getByLabel("Hasło główne", { exact: true }).fill(noweGlowne);
    await nowe.getByLabel("Powtórz", { exact: true }).fill(noweGlowne);
    await nowe
      .getByRole("checkbox", {
        name: "Rozumiem, że zapomnianego hasła głównego nie da się odzyskać.",
      })
      .click();
    await nowe.getByRole("button", { name: "Utwórz sejf" }).click();
    await expect(page.getByText(/^odblokowany · auto-blokada za /).filter({ visible: true })).toBeVisible(
      { timeout: 20_000 },
    );
    // DIAG (tymczasowe): stan ekranu po resecie
    await page.waitForTimeout(3000);
    console.log("DIAG-URL", page.url());
    console.log("DIAG-BODY", (await page.locator("body").innerText()).slice(0, 1500));
    console.log("DIAG-HTML", (await page.locator("main").first().evaluate((m) => m.outerHTML.replace(/class="[^"]*"/g, "").replace(/<svg.*?<\/svg>/g, ""))).slice(0, 6000));
    console.log("DIAG-BTNS", JSON.stringify(await page.getByRole("button").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label") || x.textContent?.trim().slice(0, 40)))));
    await expect(page.getByRole("button", { name: new RegExp(serwis) })).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);

    sprawdzZadania();
  });
});
