import { expect, test, type Page } from "@playwright/test";

import {
  czekajNaSiatke,
  kliknijSlot,
  NASTEPNY_WTOREK,
  poZapisie,
  SRODA,
  WTOREK,
  wysokoscGodziny,
  zalozKontoKalendarza,
  zasiejBlok,
  zasiejOdnowienie,
  zasiejZadanie,
} from "./helpers/kalendarz";

// Wszystkie testy pracują na stałym tygodniu (pn 11.01.2027, wt 12.01), niezależnym od „dziś”.
const TYDZIEN = `/kalendarz?widok=tydzien&data=${WTOREK}`;

// Blok w siatce (web) albo na osi (telefon) po fragmencie tytułu
const blok = (page: Page, tytul: string) =>
  page.getByRole("button", { name: new RegExp(tytul) });

// Przełączniki w lewym panelu kalendarza (web)
const wPanelu = (page: Page, sekcja: "Kategorie" | "Warstwy", nazwa: RegExp) =>
  page.getByRole("region", { name: sekcja }).getByRole("button", { name: nazwa });

test.describe("kalendarz (web)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "web", "układ webowy");
  });

  test("klik w pusty slot → Nowy wpis → blok cykliczny co tydzień", async ({
    page,
  }, info) => {
    await zalozKontoKalendarza(page, info.project.name);
    await page.goto(TYDZIEN);

    // Slot 10:00 we wtorek (po przewinięciu siatki do 06:00)
    await kliknijSlot(page, WTOREK, 600);
    const wpis = page.getByRole("dialog", { name: "Nowy wpis" });
    await expect(wpis).toContainText("10:00");
    await wpis.getByRole("button", { name: /^Blok/ }).click();

    // Okno ma dzień i godziny ze slotu
    const okno = page.getByRole("dialog", { name: "Nowy blok" });
    await expect(
      okno.getByRole("button", { name: "Dzień", exact: true }),
    ).toHaveText("wt 12.01.2027");
    await expect(
      okno.getByRole("button", { name: "Od", exact: true }),
    ).toHaveText("10:00");
    await expect(
      okno.getByRole("button", { name: "Do", exact: true }),
    ).toHaveText("11:00");

    await okno.getByLabel("Tytuł").fill("Matematyka");
    await okno.getByRole("radio", { name: "Co tydzień" }).click();
    await okno.getByRole("button", { name: "Zapisz blok" }).click();
    await expect(okno).toBeHidden();

    // Blok jest w siatce z znaczkiem serii, także tydzień później
    await expect(blok(page, "Matematyka")).toContainText("↻");
    await page.getByRole("link", { name: "Następny tydzień" }).click();
    await expect(page).toHaveURL(new RegExp(`data=${NASTEPNY_WTOREK}`));
    await expect(blok(page, "Matematyka")).toContainText("↻");
  });

  test("zadania w dymku są osobne dla każdego wystąpienia", async ({
    page,
  }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      recurrence: { freq: "weekly" },
    });
    await page.goto(TYDZIEN);

    await blok(page, "Matematyka").click();
    const dymek = page.getByRole("dialog", { name: "Szczegóły bloku" });
    await expect(dymek).toContainText("0 z 0");
    // Najpierw kończy się zapis dodania zadania (osobny POST), dopiero potem odhaczamy
    const dodanie = poZapisie(page);
    await dymek.getByLabel("Nowe zadanie").fill("Zadanie 1");
    await dymek.getByLabel("Nowe zadanie").press("Enter");
    await expect(dymek).toContainText("0 z 1");
    await dodanie;

    // Odhaczenie czeka, aż zadanie dostanie prawdziwe id z serwera (do tego czasu pole jest wyłączone);
    // nowy nasłuch zaczyna się dopiero po zakończeniu dodawania, więc łapie POST odhaczenia
    const odhaczenie = poZapisie(page);
    await dymek.getByRole("checkbox", { name: "Zadanie 1" }).check();
    await expect(dymek).toContainText("1 z 1");
    await odhaczenie;

    // Po odświeżeniu zadanie nadal jest odhaczone
    await page.reload();
    await blok(page, "Matematyka").click();
    await expect(
      page.getByRole("dialog", { name: "Szczegóły bloku" }),
    ).toContainText("1 z 1");

    // Następny tydzień: to samo wystąpienie serii, ale z pustą listą
    await page
      .getByRole("dialog", { name: "Szczegóły bloku" })
      .getByRole("button", { name: "Zamknij" })
      .click();
    await page.getByRole("link", { name: "Następny tydzień" }).click();
    await expect(page).toHaveURL(new RegExp(`data=${NASTEPNY_WTOREK}`));
    await blok(page, "Matematyka").click();
    const nastepny = page.getByRole("dialog", { name: "Szczegóły bloku" });
    await expect(nastepny).toContainText("0 z 0");
    await expect(nastepny.getByText("Brak zadań w tym bloku.")).toBeVisible();
  });

  test("edycja wystąpienia „To i następne” dzieli serię", async ({
    page,
  }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    const blokId = await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      recurrence: { freq: "weekly" },
    });
    await zasiejZadanie(
      userId,
      blokId,
      WTOREK,
      "Zadanie z pierwszego tygodnia",
    );
    await page.goto(`/kalendarz?widok=tydzien&data=${NASTEPNY_WTOREK}`);

    // Edycja wystąpienia z 19.01: start 11:00 dla tego i następnych
    await blok(page, "Matematyka").click();
    await page
      .getByRole("dialog", { name: "Szczegóły bloku" })
      .getByRole("button", { name: "Edytuj" })
      .click();
    const okno = page.getByRole("dialog", { name: "Edytuj blok" });
    await okno.getByRole("button", { name: "Od", exact: true }).click();
    // Wybór godziny to dymek poza oknem (portal), rozpoznawany po nagłówkach „Godzina” i „Minuty”
    const wybor = page.getByRole("dialog").filter({ hasText: "Minuty" });
    await wybor.getByRole("button", { name: "11", exact: true }).click();
    await wybor.getByRole("button", { name: ":00", exact: true }).click();
    await expect(
      okno.getByRole("button", { name: "Od", exact: true }),
    ).toHaveText("11:00");
    await okno.getByRole("button", { name: "Zapisz blok" }).click();

    const zakres = page.getByRole("dialog", {
      name: "Zmieniasz blok, który się powtarza",
    });
    await zakres.getByRole("radio", { name: /^To i następne/ }).check();
    await zakres.getByRole("button", { name: "Zapisz zmianę" }).click();
    await expect(zakres).toBeHidden();
    await expect(blok(page, "Matematyka")).toContainText("11:00–12:00");

    // Wcześniejsze wystąpienie zostaje o 10:00 i zachowuje swoje zadanie
    await page.getByRole("link", { name: "Poprzedni tydzień" }).click();
    await expect(page).toHaveURL(new RegExp(`data=${WTOREK}`));
    await expect(blok(page, "Matematyka")).toContainText("10:00–11:00");
    await blok(page, "Matematyka").click();
    const dymek = page.getByRole("dialog", { name: "Szczegóły bloku" });
    await expect(dymek).toContainText("0 z 1");
    await expect(
      dymek.getByText("Zadanie z pierwszego tygodnia"),
    ).toBeVisible();
  });

  test("ukrycie kategorii w panelu chowa bloki i zostaje po odświeżeniu; „+ Kategoria” dodaje kategorię", async ({
    page,
  }, info) => {
    const { userId, kategorie } = await zalozKontoKalendarza(
      page,
      info.project.name,
    );
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      categoryId: kategorie["Nauka"],
    });
    await zasiejBlok(userId, {
      title: "Bieg",
      date: SRODA,
      startMin: 420,
      categoryId: kategorie["Sport"],
    });
    await page.goto(TYDZIEN);

    await expect(blok(page, "Matematyka")).toBeVisible();
    await expect(blok(page, "Bieg")).toBeVisible();

    const nauka = wPanelu(page, "Kategorie", /Nauka/);
    await expect(nauka).toHaveAttribute("aria-pressed", "true");
    const zapis = poZapisie(page);
    await nauka.click();
    await expect(nauka).toHaveAttribute("aria-pressed", "false");
    await expect(blok(page, "Matematyka")).toHaveCount(0);
    await zapis;
    await expect(blok(page, "Bieg")).toBeVisible();

    await page.reload();
    await expect(wPanelu(page, "Kategorie", /Nauka/)).toHaveAttribute("aria-pressed", "false");
    await expect(blok(page, "Matematyka")).toHaveCount(0);
    await expect(blok(page, "Bieg")).toBeVisible();

    // Nowa kategoria od razu jest w panelu
    await page.getByRole("button", { name: "Nowa kategoria" }).click();
    const okno = page.getByRole("dialog", { name: "Nowa kategoria" });
    await okno.getByLabel("Nazwa").fill("Siłownia");
    await okno.getByRole("button", { name: "Dodaj kategorię" }).click();
    await expect(okno).toBeHidden();
    await expect(wPanelu(page, "Kategorie", /Siłownia/)).toHaveAttribute("aria-pressed", "true");
    await page.reload();
    await expect(wPanelu(page, "Kategorie", /Siłownia/)).toBeVisible();
  });

  test("kalendarz wypełnia okno: strona się nie przewija, przewija się tylko siatka", async ({
    page,
  }, info) => {
    await zalozKontoKalendarza(page, info.project.name);
    await page.goto(TYDZIEN);
    const siatka = page.getByTestId("przewijanie");
    await expect(siatka).toBeVisible();
    expect(
      await page.evaluate(
        () => document.scrollingElement!.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);
    await czekajNaSiatke(page);
    const ramka = (await siatka.boundingBox())!;
    expect(Math.round(ramka.y + ramka.height)).toBe(
      page.viewportSize()!.height,
    );
    // Nagłówek dni zostaje u góry
    const naglowek = (await page
      .getByTestId(`naglowek-${WTOREK}`)
      .boundingBox())!;
    expect(naglowek.y).toBeGreaterThanOrEqual(ramka.y - 1);
    expect(naglowek.y).toBeLessThan(ramka.y + 10);
  });

  test("przeciągnięcie bloku jednorazowego o godzinę zmienia jego start", async ({
    page,
  }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
    });
    await page.goto(TYDZIEN);

    const przycisk = blok(page, "Matematyka");
    await expect(przycisk).toContainText("10:00–11:00");
    await czekajNaSiatke(page);
    const ramka = await przycisk.boundingBox();
    if (!ramka) throw new Error("Blok nie ma ramki");
    const x = ramka.x + ramka.width / 2;
    const y = ramka.y + 16;

    // O wysokość godziny w dół to +60 min
    const godzina = await wysokoscGodziny(page, WTOREK);
    const zapis = poZapisie(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + godzina / 2, { steps: 5 });
    await page.mouse.move(x, y + godzina, { steps: 5 });
    await page.mouse.up();
    await expect(przycisk).toContainText("11:00–12:00");
    await zapis;

    await page.reload();
    await expect(blok(page, "Matematyka")).toContainText("11:00–12:00");
  });

  test("widok miesiąca pokazuje blok, widok dnia ma mini kalendarz i „Plan dnia”", async ({
    page,
  }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
    });
    await zasiejBlok(userId, { title: "Bieg", date: SRODA, startMin: 420 });

    await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
    await expect(
      page
        .getByTestId(`komorka-${WTOREK}`)
        .getByRole("button", { name: /Matematyka/ }),
    ).toBeVisible();
    await expect(
      page
        .getByTestId(`komorka-${SRODA}`)
        .getByRole("button", { name: /Bieg/ }),
    ).toBeVisible();
    await expect(page.getByText("2 wpisy widoczne")).toBeVisible();

    await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
    await expect(
      page.getByRole("heading", { level: 1, name: "Wtorek, 12 stycznia" }),
    ).toBeVisible();
    await expect(page.getByText("1 z 1 bloków")).toBeVisible();
    await expect(blok(page, "Matematyka")).toBeVisible();
    await expect(page.getByRole("region", { name: "Styczeń 2027" })).toBeVisible();
    const plan = page.getByRole("complementary", { name: "Plan dnia" });
    await expect(plan.getByTestId("liczba-Bloki")).toContainText("1");
    await expect(plan.getByTestId("liczba-Godziny")).toContainText("1");

    // Mini kalendarz przenosi na inny dzień
    await page.getByRole("button", { name: "13 stycznia" }).click();
    await expect(page).toHaveURL(new RegExp(`data=${SRODA}`));
    await expect(
      page.getByRole("heading", { level: 1, name: "Środa, 13 stycznia" }),
    ).toBeVisible();
  });

  test("odnowienie subskrypcji w kalendarzu", async ({ page }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    // Stały tydzień testów (środa 13.01.2027, w przyszłości), więc wynik nie zależy od dnia ani pory
    const idStrony = await zasiejOdnowienie(page, userId, {
      title: "Netflix",
      amount: 43,
      date: SRODA,
    });
    await page.goto(TYDZIEN);

    // Wpis stoi w przyklejonym wierszu „cały dzień”, więc nie zależy od przewinięcia siatki
    const wpis = page.getByRole("button", { name: "Netflix · 43,00 zł" });
    await expect(wpis).toBeVisible();
    await wpis.click();
    const dymek = page.getByRole("dialog", { name: "Odnowienie Netflix" });
    await expect(dymek).toContainText("Odnowienie · Subskrypcje");
    await expect(dymek).toContainText("13.02.2027");
    await dymek.getByRole("link", { name: "Otwórz w Subskrypcje" }).click();
    await expect(page).toHaveURL(new RegExp(`/strony/${idStrony}$`));

    // Warstwa „Odnowienia” chowa wpis i zapisuje się na koncie
    await page.goto(TYDZIEN);
    await expect(wpis).toBeVisible();
    const zapis = poZapisie(page);
    await wPanelu(page, "Warstwy", /Odnowienia/).click();
    await zapis;
    await expect(wpis).toHaveCount(0);
    await page.reload();
    await expect(wPanelu(page, "Warstwy", /Odnowienia/)).toHaveAttribute("aria-pressed", "false");
    await expect(wpis).toHaveCount(0);
  });
});

test.describe("kalendarz (telefon)", () => {
  test.use({ actionTimeout: 10_000 });
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test.beforeEach(({}, info) => {
    test.skip(info.project.name !== "mobile", "układ telefonu");
  });

  test("odnowienie subskrypcji: plakietka w dniu, arkusz podglądu z linkiem, kropka w miesiącu, ukrycie źródła", async ({
    page,
  }, info) => {
    const { userId } = await zalozKontoKalendarza(page, info.project.name);
    const idStrony = await zasiejOdnowienie(page, userId, {
      title: "Netflix",
      amount: 43,
      date: SRODA,
    });

    // Dzień: plakietka w pasku nad osią (układ web jest ukryty, więc rola wskazuje tylko telefon)
    await page.goto(`/kalendarz?widok=dzien&data=${SRODA}`);
    const plakietka = page.getByRole("button", { name: "↻ Netflix · 43,00 zł" });
    await expect(plakietka).toBeVisible();
    await plakietka.click();
    const arkusz = page.getByRole("dialog", { name: "Odnowienie Netflix" });
    await expect(arkusz).toContainText("Odnowienie · Subskrypcje");
    await expect(arkusz).toContainText("13.02.2027");
    await expect(arkusz).toContainText("Tylko podgląd");
    await arkusz.getByRole("link", { name: "Otwórz w Subskrypcje" }).click();
    await expect(page).toHaveURL(new RegExp(`/strony/${idStrony}$`));

    // Miesiąc: kropka odnowienia w komórce 13 stycznia
    await page.goto(`/kalendarz?widok=miesiac&data=${SRODA}`);
    await expect(
      page
        .getByRole("button", { name: "13 stycznia" })
        .getByTestId("kropka-odnowienia"),
    ).toBeVisible();

    // Ukrycie źródła w arkuszu „Kategorie” chowa odnowienie
    await page.goto(`/kalendarz?widok=dzien&data=${SRODA}`);
    await expect(plakietka).toBeVisible();
    await page.getByRole("button", { name: "Kategorie", exact: true }).click();
    const zapis = poZapisie(page);
    await page
      .getByRole("switch", { name: "Pokaż odnowienia Subskrypcje" })
      .click();
    await zapis;
    await page.keyboard.press("Escape");
    await expect(plakietka).toHaveCount(0);
  });

  test("„+” → arkusz → blok na osi dnia; miesiąc z kropką kategorii", async ({
    page,
  }, info) => {
    await zalozKontoKalendarza(page, info.project.name);
    await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);

    // „+” otwiera „Nowy wpis”; wiersz „Blok” prowadzi do arkusza nowego bloku
    await page.getByRole("button", { name: "Nowy wpis", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Nowy wpis" })
      .getByRole("button", { name: /^Blok/ })
      .click();
    const arkusz = page.getByRole("dialog", { name: "Nowy blok" });
    await arkusz.getByLabel("Nazwa bloku").fill("Fizyka");
    await arkusz.getByRole("button", { name: "Nauka" }).click();
    // Domyślnie 09:00–10:00; „Od” wstecz o dwa kroki po 15 minut
    await arkusz.getByRole("button", { name: "Zmniejsz Od" }).click();
    await arkusz.getByRole("button", { name: "Zmniejsz Od" }).click();
    await expect(arkusz.getByRole("group", { name: "Od" })).toContainText(
      "08:30",
    );
    await expect(arkusz.getByText("Czas trwania: 1 h 30 min")).toBeVisible();
    await arkusz.getByRole("button", { name: "Zapisz blok" }).click();
    await expect(arkusz).toBeHidden();

    await expect(blok(page, "Fizyka")).toContainText("08:30–10:00");

    // Miesiąc: dzień z blokiem ma kropkę w kolorze kategorii
    await page.goto(`/kalendarz?widok=miesiac&data=${WTOREK}`);
    await expect(page.getByTestId("kropka-kategorii")).toHaveCount(1);
    // Kropka jest w komórce 12 stycznia
    await expect(
      page
        .getByRole("button", { name: "12 stycznia" })
        .getByTestId("kropka-kategorii"),
    ).toHaveCount(1);
    await expect(page.getByRole("button", { name: /Fizyka/ })).toBeVisible();
  });

  test("ikona „Kategorie” otwiera arkusz; przełącznik chowa blok z osi dnia", async ({
    page,
  }, info) => {
    const { userId, kategorie } = await zalozKontoKalendarza(
      page,
      info.project.name,
    );
    await zasiejBlok(userId, {
      title: "Matematyka",
      date: WTOREK,
      startMin: 600,
      categoryId: kategorie["Nauka"],
    });
    await page.goto(`/kalendarz?widok=dzien&data=${WTOREK}`);
    await expect(blok(page, "Matematyka")).toBeVisible();

    await page.getByRole("button", { name: "Kategorie", exact: true }).click();
    const arkusz = page.getByRole("dialog", { name: "Kategorie" });
    const przelacznik = arkusz.getByRole("switch", {
      name: "Pokaż kategorię Nauka",
    });
    await expect(przelacznik).toHaveAttribute("aria-checked", "true");
    const zapis = poZapisie(page);
    await przelacznik.click();
    await expect(przelacznik).toHaveAttribute("aria-checked", "false");
    await zapis;
    await arkusz.getByRole("button", { name: "Zamknij" }).click();
    await expect(arkusz).toBeHidden();
    await expect(blok(page, "Matematyka")).toHaveCount(0);

    // Oś dnia wypełnia ekran: kończy się nad dolnym paskiem, strona się nie przewija
    const os = (await page.getByTestId("m-os-dnia").boundingBox())!;
    const pasek = (await page
      .getByRole("navigation", { name: "Moduły" })
      .boundingBox())!;
    expect(Math.round(os.y + os.height)).toBeLessThanOrEqual(
      Math.round(pasek.y) + 1,
    );
    expect(Math.round(pasek.y + pasek.height)).toBe(844);
    expect(
      await page.evaluate(
        () => document.scrollingElement!.scrollHeight <= window.innerHeight,
      ),
    ).toBe(true);
  });
});
