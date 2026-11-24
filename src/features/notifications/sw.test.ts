// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

// public/sw.js uruchamiany w osobnym kontekście z udawanym `self` (bez przeglądarki)
const KOD = readFileSync(join(process.cwd(), "public/sw.js"), "utf8");

type Okno = {
  navigate: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
};

function uruchom(okna: Okno[]) {
  const sluchacze: Record<string, (e: unknown) => void> = {};
  const self = {
    location: { origin: "https://rhytm.example" },
    addEventListener: (nazwa: string, fn: (e: unknown) => void) => {
      sluchacze[nazwa] = fn;
    },
    clients: {
      matchAll: vi.fn(async () => okna),
      openWindow: vi.fn(async () => null),
      claim: vi.fn(async () => undefined),
    },
    registration: { showNotification: vi.fn() },
  };
  runInNewContext(KOD, { self, URL });

  async function kliknij(url: unknown) {
    let obietnica: Promise<unknown> = Promise.resolve();
    sluchacze.notificationclick({
      notification: { close: vi.fn(), data: { url } },
      waitUntil: (p: Promise<unknown>) => {
        obietnica = p;
      },
    });
    await obietnica;
  }
  return { self, sluchacze, kliknij };
}

function okno(navigate: () => Promise<unknown>): Okno {
  return { navigate: vi.fn(navigate), focus: vi.fn(async () => undefined) };
}

describe("public/sw.js — notificationclick", () => {
  it("adres z tej samej domeny → nawigacja otwartej karty i focus", async () => {
    const karta = okno(async () => ({}));
    const { self, kliknij } = uruchom([karta]);
    await kliknij("/nawyki/1?x=1#a");
    expect(karta.navigate).toHaveBeenCalledWith("/nawyki/1?x=1#a");
    expect(karta.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).not.toHaveBeenCalled();
  });

  it("obcy adres (open redirect) → /dzis", async () => {
    const { self, kliknij } = uruchom([]);
    await kliknij("https://zly.example/phishing");
    expect(self.clients.openWindow).toHaveBeenCalledWith("/dzis");
    await kliknij("//zly.example/x");
    expect(self.clients.openWindow).toHaveBeenLastCalledWith("/dzis");
    await kliknij("javascript:alert(1)");
    expect(self.clients.openWindow).toHaveBeenLastCalledWith("/dzis");
  });

  it("pełny adres tej samej domeny → tylko ścieżka", async () => {
    const { self, kliknij } = uruchom([]);
    await kliknij("https://rhytm.example/kalendarz?widok=dzien&data=2026-12-02");
    expect(self.clients.openWindow).toHaveBeenCalledWith(
      "/kalendarz?widok=dzien&data=2026-12-02",
    );
  });

  it("navigate() odrzuca (karta niekontrolowana) → focus i nowe okno", async () => {
    const karta = okno(async () => {
      throw new TypeError("not controlled");
    });
    const { self, kliknij } = uruchom([karta]);
    await kliknij("/strony/1");
    expect(karta.focus).toHaveBeenCalled();
    expect(self.clients.openWindow).toHaveBeenCalledWith("/strony/1");
  });

  it("brak otwartych kart → nowe okno; brak adresu → /dzis", async () => {
    const { self, kliknij } = uruchom([]);
    await kliknij(undefined);
    expect(self.clients.openWindow).toHaveBeenCalledWith("/dzis");
  });

  it("activate przejmuje otwarte karty (clients.claim)", async () => {
    const { self, sluchacze } = uruchom([]);
    let obietnica: Promise<unknown> = Promise.resolve();
    sluchacze.activate({
      waitUntil: (p: Promise<unknown>) => {
        obietnica = p;
      },
    });
    await obietnica;
    expect(self.clients.claim).toHaveBeenCalled();
  });
});
