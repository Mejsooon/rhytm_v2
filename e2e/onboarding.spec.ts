import { expect, test, type Page } from "@playwright/test";

import { createConfirmedUser, logInViaForm, randomPassword, uniqueEmail } from "./helpers/konto";

// Web i telefon są razem w DOM (przełączane CSS), więc wybieramy wariant po nazwie projektu
const dalej = (page: Page) => page.getByRole("button", { name: "Dalej", exact: true });

async function zalozKonto(page: Page, projekt: string) {
  const email = uniqueEmail(projekt);
  const haslo = randomPassword();
  await createConfirmedUser(email, haslo, false);
  await logInViaForm(page, email, haslo);
  await expect(page).toHaveURL(/\/onboarding\/1$/);
}

test.describe("onboarding", () => {
  test.skip(!process.env.E2E_SUPABASE, "wymaga lokalnego Supabase");

  test("kreator 1→7 z wznawianiem, podsumowaniem i zmianą", async ({ page, context }, info) => {
    const mobile = info.project.name === "mobile";
    await context.grantPermissions(["notifications"]);
    await zalozKonto(page, info.project.name);

    // Krok 1: „Dalej” nieaktywne bez imienia
    // Konto z API ma w profilu nazwę z metadanych, więc najpierw ją czyścimy
    await page.getByLabel("Imię lub pseudonim").fill("");
    await expect(dalej(page)).toBeDisabled();
    await page.getByLabel("Imię lub pseudonim").fill("Mejson");
    await expect(dalej(page)).toBeEnabled();
    await page.getByRole("radio", { name: "Niedzieli" }).click();
    await page.getByRole("radio", { name: "12 h · 2:30 PM" }).click();
    await expect(page.getByRole("radio", { name: "Niedzieli" })).toHaveAttribute("aria-checked", "true");
    await dalej(page).click();

    // Krok 2: role (web: karty, telefon: checkboxy)
    await expect(page).toHaveURL(/\/onboarding\/2$/);
    const rola = (nazwa: RegExp) => page.getByRole(mobile ? "checkbox" : "button", { name: nazwa });
    await rola(/^Student/).click();
    await rola(/^Trenuję regularnie/).click();
    await page.getByLabel(/Kierunek studiów/).fill("Informatyka");
    if (!mobile) {
      // Podgląd na żywo (tylko web) pokazuje kategorię z zaznaczonej roli
      await expect(page.getByTestId("pv-cats")).toContainText("Studia");
    } else {
      await expect(page.getByTestId("pv-cats")).toBeHidden();
    }
    await dalej(page).click();

    // Krok 3: cele; „Treningi” pokazują licznik km
    await expect(page).toHaveURL(/\/onboarding\/3$/);
    await page.getByRole("button", { name: /^Subskrypcje/ }).click();
    await page.getByRole("button", { name: /^Treningi/ }).click();
    const km = page.getByRole("group", { name: "Kilometry w tygodniu" });
    await expect(km.getByText("25 km", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Zwiększ Kilometry w tygodniu" }).click();
    await expect(km.getByText("30 km", { exact: true })).toBeVisible();
    await dalej(page).click();

    // Wznawianie: po odświeżeniu i wejściu na /onboarding wracamy na zapisany krok 4, wybory zostają
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    await page.reload();
    await page.goto("/onboarding");
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    // Review Focus 1: nie wolno przeskoczyć niezapisanych kroków
    await page.goto("/onboarding/7");
    await expect(page).toHaveURL(/\/onboarding\/4$/);
    await page.goto("/onboarding/3");
    await expect(page.getByRole("button", { name: /^Subskrypcje/ })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: /^Treningi/ })).toHaveAttribute("aria-pressed", "true");
    await expect(km.getByText("30 km", { exact: true })).toBeVisible();
    await dalej(page).click();
    await expect(page).toHaveURL(/\/onboarding\/4$/);

    // Krok 4: źródło „Inne” z opisem
    const zrodla = page.getByTestId(mobile ? "source-phone" : "source-web");
    await zrodla.getByRole("button", { name: "Inne", exact: true }).click();
    await page.getByLabel("Gdzie dokładnie?").fill("podcast");
    await dalej(page).click();

    // Krok 5: Subscriptions zaznaczone z celów
    await expect(page).toHaveURL(/\/onboarding\/5$/);
    if (mobile) {
      await expect(page.getByTestId("pages-phone").getByRole("checkbox", { name: /^Subscriptions/ })).toBeChecked();
    } else {
      await expect(page.getByTestId("pages-web").getByRole("button", { name: /^Subscriptions/ })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    }
    await dalej(page).click();

    // Krok 6: przypomnienia i zgoda na powiadomienia
    await expect(page).toHaveURL(/\/onboarding\/6$/);
    const nawyki = page.getByRole("switch", { name: "Nawyki na dziś" });
    await expect(nawyki).toHaveAttribute("aria-checked", "false");
    await nawyki.click();
    await expect(nawyki).toHaveAttribute("aria-checked", "true");
    await page.getByRole("button", { name: "Zezwól" }).click();
    await expect(page.getByText("Włączone", { exact: true }).locator("visible=true")).toBeVisible();
    await expect(page.getByRole("button", { name: "Anuluj" })).toBeVisible();
    await dalej(page).click();

    // Krok 7: podsumowanie
    await expect(page).toHaveURL(/\/onboarding\/7$/);
    await expect(page.getByRole("heading", { name: "Gotowe, Mejson" })).toBeVisible();
    const podsumowanie = page.getByTestId(mobile ? "done-phone" : "done-web");
    await expect(podsumowanie).toContainText("Studia, Sport");
    await expect(podsumowanie).toContainText("Subscriptions");

    // „Zmień” przy Profilu → krok 1 z wpisanym imieniem, potem „Dalej” aż do 7
    await page.getByRole("button", { name: "Zmień: Profil" }).click();
    await expect(page).toHaveURL(/\/onboarding\/1$/);
    await expect(page.getByLabel("Imię lub pseudonim")).toHaveValue("Mejson");
    for (const krok of [2, 3, 4, 5, 6, 7]) {
      await dalej(page).click();
      await expect(page).toHaveURL(new RegExp(`/onboarding/${krok}$`));
    }

    await page.getByRole("button", { name: "Przejdź do Dziś" }).click();
    await expect(page).toHaveURL(/\/dzis$/);
    await expect(page.getByText("Witaj w rhytm, Mejson")).toBeVisible();

    // Po ukończeniu kreator nie jest już dostępny
    await page.goto("/onboarding/2");
    await expect(page).toHaveURL(/\/dzis$/);
  });
});
