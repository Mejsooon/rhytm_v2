import { readFile } from "node:fs/promises";

import { expect, test, type Browser } from "@playwright/test";

import {
  createConfirmedUser,
  logInViaForm,
  randomPassword,
  uniqueEmail,
} from "./helpers/konto";
import { latestLinkFor } from "./helpers/mailpit";
import { zalozKontoNawykow, zasiejNawyk } from "./helpers/nawyki";

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

    await page.goto("/ustawienia/ogolne");
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
    await expect(
      cele.getByRole("group", { name: "Cel snu" }).getByText("8:00", {
        exact: true,
      }),
    ).toBeVisible();
    await cele.getByRole("button", { name: "Zwiększ Cel snu" }).click();
    await expect(cele.getByText("8:15", { exact: true })).toBeVisible();
    await expect(cele.getByText("Masz niezapisane zmiany.")).toBeVisible();
    await cele.getByRole("button", { name: "Zapisz" }).click();
    await expect(cele.getByText(/Zapisano ✓/)).toBeVisible();

    await page.reload();
    // Po przeładowaniu streamowanie na chwilę zostawia ukrytą kopię karty — rola „group” pomija ukryte elementy
    await expect(
      page.getByRole("group", { name: "Cel snu" }).getByText("8:15", {
        exact: true,
      }),
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
  test("karta Konto: zmiana e-maila przez linki na oba adresy", async ({
    page,
  }, info) => {
    const stary = uniqueEmail(info.project.name);
    const nowy = uniqueEmail(`${info.project.name}-nowy`);
    const haslo = randomPassword();
    await createConfirmedUser(stary, haslo);
    await logInViaForm(page, stary, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/ogolne");
    const konto = page.getByTestId("karta-konto");
    await expect(
      konto.getByText(`${stary.toLowerCase()} · potwierdzony`),
    ).toBeVisible();
    await konto.getByRole("button", { name: "Zmień" }).click();
    await konto.getByPlaceholder("nowy@adres.pl").fill(nowy);
    await konto.getByRole("button", { name: "Wyślij link" }).click();
    await expect(
      konto.getByText(/link potwierdzający wysłany na/),
    ).toBeVisible();
    await expect(
      konto.getByText(
        "Kliknij link w obu wiadomościach: na obecnym i na nowym adresie.",
      ),
    ).toBeVisible();

    // double_confirm_changes: po jednym mailu na każdy adres; zmiana wchodzi po obu kliknięciach
    const linkStary = await latestLinkFor(stary);
    const linkNowy = await latestLinkFor(nowy);
    await page.goto(linkStary);
    await expect(page).toHaveURL(/\/ustawienia\/ogolne\?email=potwierdzono$/);
    await expect(
      page
        .getByTestId("karta-konto")
        .getByText(
          "Link potwierdzony. Kliknij jeszcze link na drugim adresie.",
        ),
    ).toBeVisible();
    await page.goto(linkNowy);
    await expect(page).toHaveURL(/\/ustawienia\/ogolne\?email=potwierdzono$/);
    await expect(
      page
        .getByTestId("karta-konto")
        .getByText(`${nowy.toLowerCase()} · potwierdzony`),
    ).toBeVisible();
  });

  test("karta Konto: wiersz Sesja i „Wyloguj” prowadzi na logowanie", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/ogolne");
    const konto = page.getByTestId("karta-konto");
    await expect(konto.getByText("Aktywna")).toBeVisible();
    await expect(konto.getByText(/· teraz$/)).toBeVisible();
    await konto.getByRole("button", { name: "Wyloguj" }).click();
    await expect(page).toHaveURL(/\/logowanie/);
  });

  test("Usuń konto: wpisanie USUŃ → wylogowanie z komunikatem, logowanie → /konto-usuniete → „Przywróć konto”", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/ogolne");
    const karta = page.getByTestId("karta-usun-konto");
    await expect(
      karta.getByText(/Konto zostanie usunięte po 30 dniach/),
    ).toBeVisible();
    await karta.getByRole("button", { name: "Usuń konto" }).click();
    const potwierdz = karta.getByRole("button", { name: "Usuń konto" });
    await expect(potwierdz).toHaveAttribute("aria-disabled", "true");
    await karta.getByPlaceholder("USUŃ").fill("USUŃ");
    await expect(potwierdz).toHaveAttribute("aria-disabled", "false");
    await potwierdz.click();

    // Wylogowany, komunikat o 30 dniach nad formularzem
    await expect(page).toHaveURL(/\/logowanie\?konto=usuniete$/);
    await expect(
      page.getByText(
        "Konto oznaczone do usunięcia. Przez 30 dni możesz je przywrócić — wystarczy się zalogować.",
      ),
    ).toBeVisible();

    // Logowanie prowadzi na ekran przywracania; aplikacja jest zamknięta
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/konto-usuniete$/);
    await expect(
      page.getByRole("heading", { name: "Konto czeka na usunięcie" }),
    ).toBeVisible();
    await expect(page.getByText(email.toLowerCase())).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Pobierz dane (.json)" }),
    ).toHaveAttribute("href", "/api/eksport");
    await page.goto("/ustawienia/ogolne");
    await expect(page).toHaveURL(/\/konto-usuniete$/);

    // Przywrócenie → aplikacja, dane konta bez zmian
    await page.getByRole("button", { name: "Przywróć konto" }).click();
    await expect(page).toHaveURL(/\/dzis$/);
    await page.goto("/ustawienia/ogolne");
    await expect(page.getByLabel("Wyświetlana nazwa")).toHaveValue(
      "Mejson E2E",
    );
    await expect(
      page.getByTestId("karta-konto").getByText(`${email.toLowerCase()} · potwierdzony`),
    ).toBeVisible();
    await page.goto("/konto-usuniete");
    await expect(page).toHaveURL(/\/dzis$/);
  });
});

// Osobny kontekst przeglądarki = osobna sesja (inny user-agent → inny opis na liście sesji)
async function drugaPrzegladarka(
  browser: Browser,
  baseURL: string | undefined,
  userAgent?: string,
) {
  const kontekst = await browser.newContext({
    baseURL,
    viewport: { width: 1440, height: 900 },
    userAgent,
  });
  const strona = await kontekst.newPage();
  return { kontekst, strona };
}

test.describe("ustawienia: konto i bezpieczeństwo", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("zmiana hasła: złe obecne → komunikat, dobre → sukces, logowanie nowym hasłem", async ({
    page,
    browser,
    baseURL,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/konto");
    const karta = page.getByTestId("karta-haslo");
    await expect(
      karta.getByRole("heading", { name: "Zmień hasło do konta" }),
    ).toBeVisible();
    const nowe = randomPassword();
    await karta.getByLabel("Obecne hasło").fill("Zle-Haslo-12345");
    await karta.getByLabel("Nowe hasło").fill(nowe);
    await karta.getByLabel("Powtórz").fill(nowe);
    await expect(karta.getByText("Hasła są takie same ✓")).toBeVisible();
    await karta.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      karta.getByText("Obecne hasło jest nieprawidłowe."),
    ).toBeVisible();

    await karta.getByLabel("Obecne hasło").fill(haslo);
    await karta.getByRole("button", { name: "Zmień hasło" }).click();
    await expect(
      karta.getByText("Hasło zmienione ✓ Inne urządzenia zostały wylogowane."),
    ).toBeVisible();
    await expect(karta.getByLabel("Obecne hasło")).toHaveValue("");

    // Podpis w Ogólnych: „zmienione DD.MM.RRRR”
    await page.goto("/ustawienia/ogolne");
    await expect(
      page
        .getByTestId("karta-konto")
        .getByText(/^zmienione \d{2}\.\d{2}\.\d{4}$/),
    ).toBeVisible();

    // Wylogowanie i logowanie nowym hasłem
    await page
      .getByTestId("karta-konto")
      .getByRole("button", { name: "Wyloguj" })
      .click();
    await expect(page).toHaveURL(/\/logowanie/);
    await logInViaForm(page, email, nowe);
    await expect(page).toHaveURL(/\/dzis$/);

    // Stare hasło już nie działa (czysty kontekst)
    const { kontekst, strona } = await drugaPrzegladarka(browser, baseURL);
    await logInViaForm(strona, email, haslo);
    await expect(
      strona.getByText("Nieprawidłowy e-mail lub hasło"),
    ).toBeVisible();
    await kontekst.close();
  });

  test("sesje: druga przeglądarka na liście, „Wyloguj” jednej i „Wyloguj wszystkie inne”", async ({
    page,
    browser,
    baseURL,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    const iphone = await drugaPrzegladarka(
      browser,
      baseURL,
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
    );
    await logInViaForm(iphone.strona, email, haslo);
    await expect(iphone.strona).toHaveURL(/\/dzis$/);
    const windows = await drugaPrzegladarka(
      browser,
      baseURL,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0",
    );
    await logInViaForm(windows.strona, email, haslo);
    await expect(windows.strona).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/konto");
    const sesje = page.getByTestId("karta-sesje");
    await expect(sesje.getByText("3 aktywne sesje")).toBeVisible();
    await expect(sesje.getByText("teraz · ta sesja")).toBeVisible();
    await expect(sesje.getByText("Aktualna")).toBeVisible();
    await expect(sesje.getByText("Safari · iPhone")).toBeVisible();
    await expect(sesje.getByText("Firefox · Windows")).toBeVisible();

    // Jedna sesja
    await sesje
      .getByRole("button", { name: "Wyloguj: Safari · iPhone" })
      .click();
    await expect(
      sesje.getByRole("status").getByText("Wylogowano: Safari · iPhone"),
    ).toBeVisible();
    await page.reload();
    await expect(
      page.getByTestId("karta-sesje").getByText("Safari · iPhone"),
    ).toHaveCount(0);

    // Wszystkie inne
    const sesje2 = page.getByTestId("karta-sesje");
    await sesje2
      .getByRole("button", { name: "Wyloguj wszystkie inne" })
      .click();
    await expect(
      sesje2.getByText("Wylogowano wszystkie inne urządzenia ✓"),
    ).toBeVisible();
    await page.reload();
    const sesje3 = page.getByTestId("karta-sesje");
    await expect(sesje3.getByText("1 aktywna sesja")).toBeVisible();
    await expect(sesje3.getByText("Firefox · Windows")).toHaveCount(0);
    await expect(
      sesje3.getByRole("button", { name: "Wyloguj wszystkie inne" }),
    ).toHaveAttribute("aria-disabled", "true");

    // Ta przeglądarka nadal zalogowana
    await expect(page).toHaveURL(/\/ustawienia\/konto$/);
    await iphone.kontekst.close();
    await windows.kontekst.close();
  });

  test("eksport pobiera plik .json z kluczem „tabele”", async ({
    page,
  }, info) => {
    const email = uniqueEmail(info.project.name);
    const haslo = randomPassword();
    await createConfirmedUser(email, haslo);
    await logInViaForm(page, email, haslo);
    await expect(page).toHaveURL(/\/dzis$/);

    await page.goto("/ustawienia/konto");
    const karta = page.getByTestId("karta-eksport");
    await expect(karta.getByText("ostatni eksport: nigdy")).toBeVisible();
    const [pobranie] = await Promise.all([
      page.waitForEvent("download"),
      karta.getByRole("button", { name: "Pobierz .json" }).click(),
    ]);
    expect(pobranie.suggestedFilename()).toMatch(
      /^rhytm-export-\d{4}-\d{2}-\d{2}\.json$/,
    );
    const json = JSON.parse(await readFile(await pobranie.path(), "utf8"));
    expect(json.format).toBe("rhytm-eksport");
    expect(json.konto.email).toBe(email.toLowerCase());
    expect(Array.isArray(json.tabele.profiles)).toBe(true);
    expect(json.tabele.profiles).toHaveLength(1);
    await expect(karta.getByText(/· pobrano$/)).toBeVisible();
    await expect(
      karta.getByRole("button", { name: "Pobierz ponownie" }),
    ).toBeVisible();
  });
});

test.describe("ustawienia: powiadomienia", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("bez VAPID: podpis push; odnowienia, cicha noc i przypomnienie nawyku zapisują się", async ({
    page,
  }, info) => {
    const userId = await zalozKontoNawykow(page, info.project.name);
    const id = await zasiejNawyk(userId, { name: "Czytanie" });

    await page.goto("/ustawienia/powiadomienia");
    const karta = page.getByTestId("karta-powiadomienia");
    // CI nie ma kluczy VAPID → push nieskonfigurowany, przełącznik zablokowany
    await expect(
      karta.getByText("Push nie jest jeszcze skonfigurowany"),
    ).toBeVisible();
    await expect(
      karta.getByRole("switch", { name: "Push na tym urządzeniu" }),
    ).toHaveAttribute("aria-disabled", "true");
    await expect(
      karta.getByRole("button", { name: "Wyślij testowe" }),
    ).toHaveAttribute("aria-disabled", "true");

    // Zapis bez „Zapisz”: czekamy na odpowiedź akcji serwera (POST na tę stronę)
    const zapis = () =>
      page.waitForResponse(
        (r) =>
          r.request().method() === "POST" &&
          r.url().includes("/ustawienia/powiadomienia"),
      );

    const odnowienia = karta.getByRole("switch", {
      name: "Odnowienia subskrypcji",
    });
    await expect(odnowienia).toHaveAttribute("aria-checked", "true");
    await Promise.all([zapis(), odnowienia.click()]);
    await expect(odnowienia).toHaveAttribute("aria-checked", "false");

    const cisza = karta.getByRole("switch", { name: "Cicha noc" });
    await Promise.all([zapis(), cisza.click()]);
    await expect(karta.getByText("Bez powiadomień 23:00–07:00")).toBeVisible();
    await karta.getByRole("button", { name: "Cicha noc od" }).click();
    await Promise.all([
      zapis(),
      page.getByRole("button", { name: "22", exact: true }).click(),
    ]);
    await page.getByRole("button", { name: "Gotowe" }).click();
    await expect(karta.getByText("Bez powiadomień 22:00–07:00")).toBeVisible();

    // Przypomnienia nawyków wymagają włączonego rodzaju „Przypomnienia o nawykach”
    await Promise.all([
      zapis(),
      karta.getByRole("switch", { name: "Przypomnienia o nawykach" }).click(),
    ]);
    const nawyki = page.getByTestId("karta-przypomnienia-nawykow");
    await expect(nawyki.getByText("wyłączone")).toBeVisible();
    await Promise.all([
      zapis(),
      nawyki.getByRole("switch", { name: "Przypomnienie: Czytanie" }).click(),
    ]);
    const godzina = nawyki.getByRole("button", {
      name: "Czytanie — godzina przypomnienia",
    });
    await expect(godzina).toHaveText("20:30");
    await godzina.click();
    await Promise.all([
      zapis(),
      page.getByRole("button", { name: "21", exact: true }).click(),
    ]);
    await page.getByRole("button", { name: "Gotowe" }).click();
    await expect(godzina).toHaveText("21:30");

    // Po odświeżeniu wszystko z bazy
    await page.reload();
    await expect(odnowienia).toHaveAttribute("aria-checked", "false");
    await expect(cisza).toHaveAttribute("aria-checked", "true");
    await expect(karta.getByText("Bez powiadomień 22:00–07:00")).toBeVisible();
    await expect(godzina).toHaveText("21:30");

    // Moduł Nawyki pokazuje godzinę przypomnienia (web: odznaka „przypomnienie 21:30”, telefon: podtytuł)
    await page.goto(`/nawyki/${id}`);
    await expect(
      page
        .getByText(/przypomnienie 21:30|21:30 przypomnienie/)
        .filter({ visible: true })
        .first(),
    ).toBeVisible();
  });
});
