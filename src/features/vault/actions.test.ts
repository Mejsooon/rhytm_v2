import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { countSecrets, createVault, getVault, resetVault, rewrapVault } from "./actions";

// Materiał o poprawnym kształcie (sól 16 B, iv 12 B, owinięty klucz 48 B)
const MATERIAL = {
  kdf: { alg: "PBKDF2-SHA-256" as const, iterations: 600000 as const, salt: "AAAAAAAAAAAAAAAAAAAAAA==" },
  wrapped_key: "A".repeat(64),
  wrap_iv: "A".repeat(16),
};
const AKTYWNY = {
  user_id: "u1",
  status: "active",
  generation: 3,
  kdf: MATERIAL.kdf,
  wrapped_key: MATERIAL.wrapped_key,
  wrap_iv: MATERIAL.wrap_iv,
  created_at: "2026-11-21T10:00:00.000Z",
  updated_at: "2026-11-21T11:00:00.000Z",
};

let vaults: ReturnType<typeof fakeTable>;

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  vaults = fakeTable({ single: AKTYWNY });
  from.mockImplementation((nazwa: string) => (nazwa === "vaults" ? vaults : fakeTable()));
});

describe("bez sesji", () => {
  it.each([
    ["getVault", () => getVault()],
    ["createVault", () => createVault(MATERIAL)],
    ["rewrapVault", () => rewrapVault(MATERIAL, "x")],
    ["resetVault", () => resetVault()],
    ["countSecrets", () => countSecrets()],
  ])("%s przekierowuje na /logowanie", async (_nazwa, akcja) => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(akcja()).rejects.toThrow("REDIRECT:/logowanie");
  });
});

describe("getVault", () => {
  it("zwraca materiał aktywnego sejfu z generation i znacznikami czasu", async () => {
    const w = await getVault();
    expect(w).toEqual({
      ok: true,
      vault: {
        kdf: MATERIAL.kdf,
        wrapped_key: MATERIAL.wrapped_key,
        wrap_iv: MATERIAL.wrap_iv,
        generation: 3,
        created_at: AKTYWNY.created_at,
        updated_at: AKTYWNY.updated_at,
      },
    });
    expect(vaults.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("brak wiersza albo status reset → vault: null", async () => {
    vaults = fakeTable({ single: null });
    expect(await getVault()).toEqual({ ok: true, vault: null });
    vaults = fakeTable({ single: { ...AKTYWNY, status: "reset" } });
    expect(await getVault()).toEqual({ ok: true, vault: null });
  });

  it("błąd bazy → ok:false", async () => {
    vaults = fakeTable({ error: { message: "boom" } });
    expect((await getVault()).ok).toBe(false);
  });
});

describe("createVault", () => {
  it("brak wiersza → INSERT z generation 1", async () => {
    vaults = fakeTable({ single: null });
    const w = await createVault(MATERIAL);
    expect(w).toEqual({ ok: true, generation: 1 });
    expect(vaults.insert).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: "u1", status: "active", generation: 1, wrapped_key: MATERIAL.wrapped_key }),
    );
  });

  it("drugi raz → „Sejf już istnieje.”", async () => {
    const w = await createVault(MATERIAL);
    expect(w).toEqual({ ok: false, message: "Sejf już istnieje." });
    expect(vaults.insert).not.toHaveBeenCalled();
    expect(vaults.update).not.toHaveBeenCalled();
  });

  it("po resecie → UPDATE na active z generation z wiersza (reset już je podbił)", async () => {
    vaults = fakeTable({ single: { ...AKTYWNY, status: "reset", generation: 4 } });
    const w = await createVault(MATERIAL);
    expect(w).toEqual({ ok: true, generation: 4 });
    expect(vaults.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", kdf: MATERIAL.kdf, wrapped_key: MATERIAL.wrapped_key, wrap_iv: MATERIAL.wrap_iv }),
    );
    expect(vaults.eq).toHaveBeenCalledWith("status", "reset");
    expect(vaults.insert).not.toHaveBeenCalled();
  });

  it("odrzuca materiał o złym kształcie bez zapytania", async () => {
    const w = await createVault({ ...MATERIAL, wrap_iv: "zle" });
    expect(w.ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});

describe("rewrapVault", () => {
  it("ze starym updated_at → błąd innej karty", async () => {
    // UPDATE z warunkiem updated_at nie trafia w żaden wiersz
    vaults = fakeTable({ single: null });
    const w = await rewrapVault(MATERIAL, "2026-01-01T00:00:00.000Z");
    expect(w).toEqual({ ok: false, message: "Sejf zmienił się w innej karcie. Odblokuj go ponownie." });
    expect(vaults.eq).toHaveBeenCalledWith("updated_at", "2026-01-01T00:00:00.000Z");
  });

  it("z aktualnym updated_at zapisuje nowy materiał i zwraca nowy updated_at", async () => {
    vaults = fakeTable({ single: { updated_at: "2026-11-21T12:00:00.000Z" } });
    const w = await rewrapVault(MATERIAL, AKTYWNY.updated_at);
    expect(w).toEqual({ ok: true, updated_at: "2026-11-21T12:00:00.000Z" });
    expect(vaults.eq).toHaveBeenCalledWith("status", "active");
    expect(vaults.update).toHaveBeenCalledWith(
      expect.objectContaining({ kdf: MATERIAL.kdf, wrapped_key: MATERIAL.wrapped_key, wrap_iv: MATERIAL.wrap_iv }),
    );
  });
});

describe("resetVault i countSecrets", () => {
  it("resetVault zwraca cleared z funkcji SQL", async () => {
    rpc.mockResolvedValue({ data: 7, error: null });
    expect(await resetVault()).toEqual({ ok: true, cleared: 7 });
    expect(rpc).toHaveBeenCalledWith("reset_vault");
  });

  it("countSecrets zwraca liczbę z funkcji SQL", async () => {
    rpc.mockResolvedValue({ data: 2, error: null });
    expect(await countSecrets()).toEqual({ ok: true, count: 2 });
    expect(rpc).toHaveBeenCalledWith("count_secrets");
  });

  it("błąd RPC → ok:false", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await resetVault()).ok).toBe(false);
    expect((await countSecrets()).ok).toBe(false);
  });
});

describe("komunikaty błędów", () => {
  it("nie zawierają wartości iv/ct ani tekstu z materiału", async () => {
    const sekret = "SEKRETNYTEKST";
    vaults = fakeTable({ single: AKTYWNY, error: { message: `boom ${sekret} ${MATERIAL.wrapped_key}` } });
    rpc.mockResolvedValue({ data: null, error: { message: `boom ${sekret}` } });
    const wyniki = [
      await getVault(),
      await createVault(MATERIAL),
      await rewrapVault(MATERIAL, "x"),
      await resetVault(),
      await countSecrets(),
      await createVault({ ...MATERIAL, wrapped_key: sekret }),
    ];
    for (const w of wyniki) {
      expect(w.ok).toBe(false);
      const tekst = JSON.stringify(w);
      expect(tekst).not.toContain(sekret);
      expect(tekst).not.toContain(MATERIAL.wrapped_key);
      expect(tekst).not.toContain(MATERIAL.wrap_iv);
    }
  });
});
