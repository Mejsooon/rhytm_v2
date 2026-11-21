import { randomBytes } from "node:crypto";

import { expect, test } from "@playwright/test";

import { zalozKontoStron } from "./helpers/strony";

// Sejf zero-knowledge: przepływ od ustawienia do resetu, z kontrolą, że hasła nie opuszczają przeglądarki.
test.describe("sejf", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("Passwords: ustawienie, zapis, blokada, odblokowanie, Pokaż i reset — bez haseł w żądaniach", async ({
    page,
  }, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
    // PBKDF2 600 000 iteracji ×3 (ustawienie, odblokowanie, ponowne ustawienie) + zapisy
    test.setTimeout(120_000);

    // Unikalne hasła; „Tajne!…&” ma znaki zmieniane przez kodowanie URL, więc sprawdzamy też formę zakodowaną
    const sufiks = randomBytes(6).toString("hex");
    const haslo = `Tajne!${sufiks}&zbyt Dlugie-7`;
    const glowne = `Glowne-${sufiks}-Kl3ucz!Dluuugie`;
    const noweGlowne = `Nowe-${sufiks}-Gl0wne!Dluuugie`;
    const zlyGlowne = `Zle-${sufiks}-Haslo!Dluuugie9`;
    const serwis = `Serwis-${sufiks}`;
    const login = `login-${sufiks}`;
    const zakazane = [haslo, glowne, noweGlowne, zlyGlowne].flatMap((h) => [
      h,
      encodeURIComponent(h),
      encodeURI(h),
      JSON.stringify(h).slice(1, -1),
    ]);

    // Wszystkie żądania z całego testu: adres i treść (także binarna)
    const zadania: { url: string; metoda: string; tresc: string }[] = [];
    page.on("request", (zadanie) => {
      const bufor = zadanie.postDataBuffer();
      zadania.push({
        url: zadanie.url(),
        metoda: zadanie.method(),
        tresc: bufor ? bufor.toString("utf8") + bufor.toString("latin1") : "",
      });
    });
    function sprawdzZadania() {
      for (const z of zadania) {
        for (const h of zakazane) {
          expect(z.url, `adres ${z.url} zawiera hasło`).not.toContain(h);
          expect(
            z.tresc,
            `treść ${z.metoda} ${z.url} zawiera hasło`,
          ).not.toContain(h);
        }
      }
    }

    await zalozKontoStron(page, info.project.name);

    // Strona Passwords z szablonu
    await page.goto("/strony/nowa");
    await page.getByRole("button", { name: /^Passwords/ }).click();
    await page.getByRole("button", { name: "Utwórz stronę" }).click();
    await expect(page).toHaveURL(/\/strony\/[0-9a-f-]{36}$/);
    const adresStrony = new URL(page.url()).pathname;
    await expect(
      page.getByRole("heading", { name: "Passwords", level: 1 }),
    ).toBeVisible();

    // Ustawienie sejfu: miernik siły, zgoda, „Utwórz sejf”
    const ustawianie = page.getByRole("form", {
      name: "Ustaw hasło główne sejfu",
    });
    await expect(ustawianie).toBeVisible();
    await expect(
      ustawianie.getByRole("button", { name: "Utwórz sejf" }),
    ).toBeDisabled();
    await ustawianie.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await expect(
      ustawianie.getByText(/^(Średnie|Mocne|Bardzo mocne)$/),
    ).toBeVisible();
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
    await expect(page.getByText("AES-GCM w przeglądarce")).toBeVisible();
    sprawdzZadania();

    // Nowy wiersz z hasłem
    await page
      .getByRole("button", { name: "Nowy wiersz", exact: true })
      .click();
    const edycja = page.getByRole("row").filter({
      has: page.getByRole("textbox", { name: "Serwis" }),
    });
    await edycja.getByRole("textbox", { name: "Serwis" }).fill(serwis);
    await edycja.getByRole("textbox", { name: "Login" }).fill(login);
    // Pole hasła ma type=password, więc nie jest „textbox” — szukamy po etykiecie
    await edycja.getByLabel("Hasło", { exact: true }).fill(haslo);
    await edycja.getByRole("button", { name: "Zapisz", exact: true }).click();
    const wiersz = page.getByRole("row").filter({ hasText: serwis });
    await expect(wiersz).toBeVisible();
    await expect(wiersz.getByText("••••••••••••")).toBeVisible();
    await page.waitForLoadState("networkidle");
    sprawdzZadania();

    // „Pokaż” odsłania hasło, ponowny klik ukrywa
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toHaveCount(0);

    // „Zablokuj teraz” → zablokowane, hasło znika z DOM
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zablokuj teraz" }).click();
    await expect(
      page.getByText("Sejf zablokowany", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText("serwer widzi tylko szyfrogram")).toBeVisible();
    await expect(
      wiersz.getByText("zablokowane", { exact: true }),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);

    // Odblokowanie: najpierw złe hasło, potem dobre
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
      page.getByText("Sejf zablokowany", { exact: true }),
    ).toBeVisible();
    await karta.getByLabel("Hasło główne", { exact: true }).fill(glowne);
    await karta.getByRole("button", { name: "Odblokuj", exact: true }).click();
    await expect(
      page.getByText("Sejf odblokowany", { exact: true }),
    ).toBeVisible({
      timeout: 20_000,
    });
    await expect(karta).toHaveCount(0);

    // „Pokaż” po ponownym odblokowaniu
    await wiersz.getByRole("button", { name: "Pokaż hasło" }).click();
    await expect(wiersz.getByText(haslo, { exact: true })).toBeVisible();
    sprawdzZadania();

    // Reset w Ustawienia → Sejf (po przeładowaniu sejf jest zablokowany; reset działa też zablokowany)
    await page.goto("/ustawienia/sejf");
    await expect(
      page.getByRole("heading", { name: "Sejf", exact: true }),
    ).toBeVisible();
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
    await expect(reset.getByText("1 sekret", { exact: true })).toBeVisible();
    await expect(reset.getByText("serwisy, loginy, URL-e")).toBeVisible();
    // Bez wpisanego słowa reset nic nie robi
    await reset
      .getByRole("button", { name: "Zresetuj sejf", exact: true })
      .click();
    await expect(reset).toBeVisible();
    await reset.getByPlaceholder("RESETUJ").fill("RESETUJ");
    await reset
      .getByRole("button", { name: "Zresetuj sejf", exact: true })
      .click();
    await expect(reset).toHaveCount(0);
    await expect(page.getByText("Nie ustawiony")).toBeVisible({
      timeout: 20_000,
    });

    // Strona Passwords po resecie: wiersz zostaje, hasło jest puste, a sejf trzeba ustawić od nowa
    await page.goto(adresStrony);
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
    const poResecie = page.getByRole("row").filter({ hasText: serwis });
    await expect(poResecie).toBeVisible();
    await expect(poResecie.getByText(login)).toBeVisible();
    await expect(
      poResecie.getByRole("button", { name: "Pokaż hasło" }),
    ).toHaveCount(0);
    // Wiersz ma więcej pustych komórek („—”), więc bierzemy pierwszą
    await expect(
      poResecie.getByText("—", { exact: true }).first(),
    ).toBeVisible();
    await expect(page.getByText(haslo, { exact: true })).toHaveCount(0);

    // Na końcu: żadne żądanie z całego testu nie niosło żadnego z haseł; sprawdzamy też, że coś w ogóle złapaliśmy
    expect(zadania.filter((z) => z.metoda === "POST").length).toBeGreaterThan(
      0,
    );
    sprawdzZadania();
  });
});
