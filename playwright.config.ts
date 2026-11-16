import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  // Artefakty Playwrighta osobno, bo outputDir jest czyszczony przed każdym uruchomieniem,
  // a w test-results/ leżą też zrzuty makiet (mockups/) i zrzuty porównawcze (visual/)
  outputDir: "test-results/artifacts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    // Lokalnie systemowy Chrome (pobieranie przeglądarki Playwrighta bywa zablokowane), w CI własny Chromium
    channel: process.env.CI ? undefined : "chrome",
  },
  projects: [
    // Układ webowy (od 800 px)
    { name: "web", use: { viewport: { width: 1440, height: 900 } } },
    // Układ telefonu (poniżej 800 px)
    {
      name: "mobile",
      use: {
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
  webServer: {
    // W CI aplikacja jest już zbudowana osobnym krokiem
    command: process.env.CI ? "pnpm start" : "pnpm build && pnpm start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
    // Zmienne (adres Supabase, klucze, Turnstile) przechodzą z procesu testów do serwera aplikacji
    env: process.env as Record<string, string>,
  },
});
