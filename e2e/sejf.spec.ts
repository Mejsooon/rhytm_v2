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
    await expect(
      page.getByText("Blokada po 5 min bezczynności."),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);
    await expect(page.getByText(notatka, { exact: true })).toHaveCount(0);

    // Zamknięty sejf: sama karta na środku, bez tabeli, wyszukiwarki i „Kategorie”
    await expect(wiersz).toHaveCount(0);
    await expect(page.getByText(serwis, { exact: true })).toHaveCount(0);
    await expect(szukaj).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Nowy", exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: "Kategorie", exact: true }),
    ).toHaveCount(0);

    // Odblokowanie: najpierw puste pole, potem złe hasło, potem dobre
    const karta = page.getByRole("region", { name: "Odblokuj sejf" });
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

    // Po odblokowaniu tabela wraca; segment „Kategoria” zawęża po jawnej kolumnie
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
});
