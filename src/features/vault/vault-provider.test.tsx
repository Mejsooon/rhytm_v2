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

import { createVaultMaterial, type VaultMaterial } from "./crypto";
import { useVault, VaultProvider } from "./vault-provider";

const HASLO = "poprawne-haslo-glowne";
const PIEC_MIN = 5 * 60 * 1000;
let material: VaultMaterial;

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
  material = (await createVaultMaterial(HASLO)).material;
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

  it("aktywność resetuje licznik", async () => {
    const widok = await zamontuj();
    await act(async () => {
      await widok.result.current.unlock(HASLO);
    });
    await act(async () => {
      vi.advanceTimersByTime(4 * 60 * 1000);
    });
    act(() => {
      window.dispatchEvent(new Event("pointerdown"));
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
});
