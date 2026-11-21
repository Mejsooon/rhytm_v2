import * as React from "react";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const { getVault, createVault, rewrapVaultAction, resetVault } = vi.hoisted(() => ({
  getVault: vi.fn(),
  createVault: vi.fn(),
  rewrapVaultAction: vi.fn(),
  resetVault: vi.fn(),
}));

vi.mock("./actions", () => ({ getVault, createVault, rewrapVault: rewrapVaultAction, resetVault }));

// unwrapDataKey owinięty w vi.fn, żeby w wybranych testach ręcznie odroczyć odwijanie klucza
vi.mock("./crypto", async (importOriginal) => {
  const oryginal = await importOriginal<typeof import("./crypto")>();
  return { ...oryginal, unwrapDataKey: vi.fn(oryginal.unwrapDataKey) };
});

import { createVaultMaterial, unwrapDataKey, type VaultMaterial } from "./crypto";
import { useVault, VaultProvider } from "./vault-provider";

const HASLO = "poprawne-haslo-glowne";
const PIEC_MIN = 5 * 60 * 1000;
let material: VaultMaterial;
let material2: VaultMaterial;
let kluczTestowy: CryptoKey;
const HASLO2 = "inne-haslo-glowne-2";

function wrapper({ children }: { children: React.ReactNode }) {
  return <VaultProvider>{children}</VaultProvider>;
}

// Renderuje provider i czeka, aż skończy się wstępne getVault
async function zamontuj() {
  const widok = renderHook(() => useVault(), { wrapper });
  await act(async () => {});
  await act(async () => {});
  return widok;
}

beforeAll(async () => {
  // Prawdziwa kryptografia (PBKDF2 600 000 iteracji): materiał liczymy raz
  const pierwszy = await createVaultMaterial(HASLO);
  material = pierwszy.material;
  kluczTestowy = pierwszy.key;
  material2 = (await createVaultMaterial(HASLO2)).material;
}, 30000);

beforeEach(() => {
  getVault.mockResolvedValue({
    ok: true,
    vault: { ...material, generation: 3, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-01T10:00:00Z" },
  });
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  getVault.mockReset();
  createVault.mockReset();
  rewrapVaultAction.mockReset();
  resetVault.mockReset();
});

describe("VaultProvider", () => {
  it("po unlock status odblokowany, po 5 min bez aktywności zablokowany", async () => {
    const widok = await zamontuj();
    expect(widok.result.current.status).toBe("zablokowany");
    expect(widok.result.current.generation).toBe(3);

    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.unlock(HASLO);
    });
    expect(wynik).toEqual({ ok: true });
    expect(widok.result.current.status).toBe("odblokowany");

    await act(async () => {
      vi.advanceTimersByTime(PIEC_MIN - 2000);
    });
    expect(widok.result.current.status).toBe("odblokowany");
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });
    expect(widok.result.current.status).toBe("zablokowany");
  });

  it("aktywność (zdarzenie zaufane) resetuje licznik", async () => {
    // jsdom nie tworzy zdarzeń z isTrusted = true, więc wywołujemy nasłuch bezpośrednio
    const nasluchy: { typ: string; fn: EventListener }[] = [];
    const dodaj = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation((typ, fn, opcje) => {
      if (typeof fn === "function") nasluchy.push({ typ, fn });
      dodaj(typ, fn, opcje);
    });
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    act(() => {
      for (const n of nasluchy.filter((x) => x.typ === "pointerdown")) n.fn({ isTrusted: true } as Event);
    });
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    expect(widok.result.current.status).toBe("odblokowany");
    await act(async () => {
      vi.advanceTimersByTime(61 * 1000);
    });
    expect(widok.result.current.status).toBe("zablokowany");
  });

  it("zdarzenie syntetyczne (isTrusted = false) nie resetuje licznika", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    act(() => {
      // dispatchEvent ze skryptu daje isTrusted = false
      for (const typ of ["pointerdown", "keydown", "wheel", "touchstart", "scroll"]) window.dispatchEvent(new Event(typ));
    });
    await act(async () => {
      vi.advanceTimersByTime(61 * 1000);
    });
    expect(widok.result.current.status).toBe("zablokowany");
  });

  it("ukryta karta: po powrocie po 6 min od razu zablokowany", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    // Skok zegara bez odpalania timerów (uśpiona karta), potem powrót na kartę
    vi.setSystemTime(Date.now() + 6 * 60 * 1000);
    expect(widok.result.current.status).toBe("odblokowany");
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(widok.result.current.status).toBe("zablokowany");
  });

  it("lock czyści klucz (encrypt rzuca)", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    const szyfrogram = await widok.result.current.encrypt("tajne");
    expect(szyfrogram.g).toBe(3);
    expect(await widok.result.current.decrypt(szyfrogram)).toBe("tajne");

    act(() => {
      widok.result.current.lock();
    });
    expect(widok.result.current.status).toBe("zablokowany");
    await expect(widok.result.current.encrypt("tajne")).rejects.toThrow("Nie zapisano. Sejf musi być odblokowany.");
    expect(await widok.result.current.decrypt(szyfrogram)).toBeNull();
  });

  it("złe hasło → Nieprawidłowe hasło główne.", async () => {
    const widok = await zamontuj();
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.unlock("zle-haslo");
    });
    expect(wynik).toEqual({ ok: false, message: "Nieprawidłowe hasło główne." });
    expect(widok.result.current.status).toBe("zablokowany");
  });

  it("brak WebCrypto → nieobslugiwany", async () => {
    vi.stubGlobal("crypto", undefined);
    const widok = await zamontuj();
    expect(widok.result.current.status).toBe("nieobslugiwany");
    expect(getVault).not.toHaveBeenCalled();
  });

  it("brak sejfu → status brak", async () => {
    getVault.mockResolvedValue({ ok: true, vault: null });
    const widok = await zamontuj();
    expect(widok.result.current.status).toBe("brak");
    expect(widok.result.current.generation).toBeNull();
  });

  it("onStaleGeneration blokuje i odświeża sejf", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    getVault.mockResolvedValue({
      ok: true,
      vault: { ...material, generation: 4, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-02T10:00:00Z" },
    });
    await act(async () => {
      widok.result.current.onStaleGeneration();
    });
    await act(async () => {});
    expect(widok.result.current.status).toBe("zablokowany");
    expect(widok.result.current.generation).toBe(4);
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("reset czyści klucz i wraca do brak", async () => {
    resetVault.mockResolvedValue({ ok: true, cleared: 2 });
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.reset();
    });
    expect(wynik).toEqual({ ok: true, cleared: 2 });
    expect(widok.result.current.status).toBe("brak");
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("changePassword przekazuje updated_at i zapamiętuje nowy", async () => {
    rewrapVaultAction.mockResolvedValue({ ok: true, updated_at: "2026-11-03T10:00:00Z" });
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.changePassword(HASLO, "nowe-haslo-glowne");
    });
    expect(wynik).toEqual({ ok: true });
    expect(rewrapVaultAction).toHaveBeenCalledTimes(1);
    expect(rewrapVaultAction.mock.calls[0][1]).toBe("2026-11-01T10:00:00Z");

    rewrapVaultAction.mockResolvedValue({ ok: true, updated_at: "2026-11-04T10:00:00Z" });
    await act(async () => {
      await widok.result.current.changePassword("nowe-haslo-glowne", "jeszcze-inne-haslo");
    });
    expect(rewrapVaultAction.mock.calls[1][1]).toBe("2026-11-03T10:00:00Z");
  });

  it("changePassword ze złym starym hasłem → Nieprawidłowe hasło główne.", async () => {
    const widok = await zamontuj();
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.changePassword("zle", "nowe-haslo-glowne");
    });
    expect(wynik).toEqual({ ok: false, message: "Nieprawidłowe hasło główne." });
    expect(rewrapVaultAction).not.toHaveBeenCalled();
  });

  it("nic nie trafia do localStorage/sessionStorage", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    await widok.result.current.encrypt("tajne");
    act(() => {
      widok.result.current.lock();
    });
    expect(setItem).not.toHaveBeenCalled();
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("zmiana hasła w innej karcie: stare hasło + nowszy updated_at → sukces", async () => {
    const widok = await zamontuj();
    getVault.mockResolvedValue({
      ok: true,
      vault: { ...material2, generation: 3, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-05T10:00:00Z" },
    });
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.unlock(HASLO2);
    });
    expect(wynik).toEqual({ ok: true });
    expect(widok.result.current.status).toBe("odblokowany");
  });

  it("złe hasło i ten sam updated_at → Nieprawidłowe hasło główne. (bez ponawiania)", async () => {
    const widok = await zamontuj();
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.unlock(HASLO2);
    });
    expect(wynik).toEqual({ ok: false, message: "Nieprawidłowe hasło główne." });
  });

  it("changePassword: nowszy updated_at z innym materiałem → sukces z nowym oczekiwanym updated_at", async () => {
    rewrapVaultAction.mockResolvedValue({ ok: true, updated_at: "2026-11-06T10:00:00Z" });
    const widok = await zamontuj();
    getVault.mockResolvedValue({
      ok: true,
      vault: { ...material2, generation: 3, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-05T10:00:00Z" },
    });
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.changePassword(HASLO2, "nowe-haslo-glowne");
    });
    expect(wynik).toEqual({ ok: true });
    expect(rewrapVaultAction.mock.calls[0][1]).toBe("2026-11-05T10:00:00Z");
  });

  it("za słabe hasło: setup i changePassword nie wołają serwera", async () => {
    const widok = await zamontuj();
    let a: unknown;
    let b: unknown;
    await act(async () => {
      a = await widok.result.current.setup("krotkie");
      b = await widok.result.current.changePassword(HASLO, "krotkie");
    });
    const komunikat = "Hasło główne jest za słabe. Wymagane co najmniej „Średnie”.";
    expect(a).toEqual({ ok: false, message: komunikat });
    expect(b).toEqual({ ok: false, message: komunikat });
    expect(createVault).not.toHaveBeenCalled();
    expect(rewrapVaultAction).not.toHaveBeenCalled();
  });

  it("lock() w trakcie unlock: klucz się nie odradza", async () => {
    const widok = await zamontuj();
    let rozwiaz!: (k: CryptoKey) => void;
    vi.mocked(unwrapDataKey).mockImplementationOnce(() => new Promise((r) => (rozwiaz = r)));
    let obietnica!: Promise<unknown>;
    await act(async () => {
      obietnica = widok.result.current.unlock(HASLO);
    });
    act(() => {
      widok.result.current.lock();
    });
    let wynik: unknown;
    await act(async () => {
      rozwiaz(kluczTestowy);
      wynik = await obietnica;
    });
    expect(wynik).toEqual({ ok: false, message: "Sejf został zablokowany. Spróbuj ponownie." });
    expect(widok.result.current.status).toBe("zablokowany");
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("reset() w trakcie unlock: klucz się nie odradza", async () => {
    resetVault.mockResolvedValue({ ok: true, cleared: 0 });
    const widok = await zamontuj();
    let rozwiaz!: (k: CryptoKey) => void;
    vi.mocked(unwrapDataKey).mockImplementationOnce(() => new Promise((r) => (rozwiaz = r)));
    let obietnica!: Promise<unknown>;
    await act(async () => {
      obietnica = widok.result.current.unlock(HASLO);
    });
    await act(async () => {
      await widok.result.current.reset();
    });
    let wynik: unknown;
    await act(async () => {
      rozwiaz(kluczTestowy);
      wynik = await obietnica;
    });
    expect(wynik).toMatchObject({ ok: false });
    expect(widok.result.current.status).toBe("brak");
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("odmontowanie w trakcie unlock: klucz nie zostaje ustawiony", async () => {
    const widok = await zamontuj();
    const encrypt = widok.result.current.encrypt;
    let rozwiaz!: (k: CryptoKey) => void;
    vi.mocked(unwrapDataKey).mockImplementationOnce(() => new Promise((r) => (rozwiaz = r)));
    let obietnica!: Promise<unknown>;
    await act(async () => {
      obietnica = widok.result.current.unlock(HASLO);
    });
    widok.unmount();
    let wynik: unknown;
    await act(async () => {
      rozwiaz(kluczTestowy);
      wynik = await obietnica;
    });
    expect(wynik).toMatchObject({ ok: false });
    await expect(encrypt("x")).rejects.toThrow();
  });

  it("lock() w trakcie setup: klucz się nie odradza", async () => {
    getVault.mockResolvedValue({ ok: true, vault: null });
    const widok = await zamontuj();
    let rozwiaz!: (r: unknown) => void;
    createVault.mockImplementationOnce(() => new Promise((r) => (rozwiaz = r)));
    let obietnica!: Promise<unknown>;
    await act(async () => {
      obietnica = widok.result.current.setup("bardzo-dobre-haslo-123");
      // createVaultMaterial liczy PBKDF2; czekamy, aż setup dojdzie do createVault
      while (!rozwiaz) await new Promise((r) => setImmediate(r));
    });
    act(() => {
      widok.result.current.lock();
    });
    let wynik: unknown;
    await act(async () => {
      rozwiaz({ ok: true, generation: 1 });
      wynik = await obietnica;
    });
    expect(wynik).toMatchObject({ ok: false });
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("zmiana generacji na serwerze przy odblokowanej karcie → zablokowany", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    getVault.mockResolvedValue({
      ok: true,
      vault: { ...material, generation: 4, created_at: "2026-11-01T10:00:00Z", updated_at: "2026-11-02T10:00:00Z" },
    });
    // Złe stare hasło wymusza doczytanie sejfu (odswiez) przy odblokowanym kluczu
    await act(async () => {
      await widok.result.current.changePassword("zle-haslo-glowne", "nowe-haslo-glowne");
    });
    expect(widok.result.current.status).toBe("zablokowany");
    expect(widok.result.current.generation).toBe(4);
    await expect(widok.result.current.encrypt("x")).rejects.toThrow();
  });

  it("pierwszy getVault rzuca: status ladowanie, unlock ponawia pobranie", async () => {
    getVault.mockRejectedValueOnce(new Error("siec"));
    const widok = await zamontuj();
    expect(widok.result.current.status).toBe("ladowanie");
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.unlock(HASLO);
    });
    expect(wynik).toEqual({ ok: true });
    expect(widok.result.current.status).toBe("odblokowany");
  });

  it("wyjątek akcji serwerowej → komunikat zamiast rzucenia", async () => {
    resetVault.mockRejectedValue(new Error("siec"));
    const widok = await zamontuj();
    let wynik: unknown;
    await act(async () => {
      wynik = await widok.result.current.reset();
    });
    expect(wynik).toEqual({ ok: false, message: "Nie udało się połączyć z sejfem. Spróbuj ponownie." });
  });

  it("odmontowanie: wcześniej pobrane encrypt rzuca", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    const encrypt = widok.result.current.encrypt;
    widok.unmount();
    await expect(encrypt("x")).rejects.toThrow();
  });
});
