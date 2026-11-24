import { beforeEach, describe, expect, it, vi } from "vitest";

// Usuwanie i przywracanie konta (requestAccountDeletion, restoreAccount) — osobny plik, bo potrzebuje from() i storage
const { getUser, signOut, revalidatePath, zapytania, wynikiProfilu, remove } =
  vi.hoisted(() => ({
    getUser: vi.fn(),
    signOut: vi.fn(),
    revalidatePath: vi.fn(),
    // Każde wywołanie from(): tabela, operacja i jej argumenty
    zapytania: [] as {
      tabela: string;
      operacja: string;
      wartosci?: unknown;
      eq?: [string, unknown];
    }[],
    // Wyniki kolejnych update().select().maybeSingle() na profiles
    wynikiProfilu: vi.fn(),
    remove: vi.fn(),
  }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, signOut },
    from: (tabela: string) => ({
      update: (wartosci: unknown) => {
        const wpis: (typeof zapytania)[number] = {
          tabela,
          operacja: "update",
          wartosci,
        };
        zapytania.push(wpis);
        return {
          eq: (kolumna: string, wartosc: unknown) => {
            wpis.eq = [kolumna, wartosc];
            const wynik = Promise.resolve({ data: null, error: null });
            return Object.assign(wynik, {
              select: () => ({ maybeSingle: wynikiProfilu }),
            });
          },
        };
      },
      delete: () => {
        const wpis: (typeof zapytania)[number] = { tabela, operacja: "delete" };
        zapytania.push(wpis);
        return {
          eq: async (kolumna: string, wartosc: unknown) => {
            wpis.eq = [kolumna, wartosc];
            // Stara baza: tabela push_subscriptions jeszcze nie istnieje
            return { error: { code: "42P01" } };
          },
        };
      },
    }),
    storage: { from: () => ({ remove }) },
  }),
}));
vi.mock("@/lib/auth/hibp", () => ({ isPasswordPwned: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { requestAccountDeletion, restoreAccount } from "./account-actions";

beforeEach(() => {
  vi.clearAllMocks();
  zapytania.length = 0;
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  signOut.mockResolvedValue({ error: null });
  remove.mockResolvedValue({ error: null });
});

describe("requestAccountDeletion", () => {
  it("złe słowo → komunikat bez zapisu i bez wylogowania", async () => {
    expect(await requestAccountDeletion("usun")).toEqual({
      ok: false,
      message: "Wpisz USUŃ, żeby potwierdzić.",
    });
    expect(zapytania).toEqual([]);
    expect(getUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("bez sesji → /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requestAccountDeletion("USUŃ")).rejects.toThrow(
      "REDIRECT:/logowanie",
    );
  });

  it("błąd zapisu (np. stara baza) → komunikat, bez usuwania urządzeń, zdjęcia i wylogowania", async () => {
    wynikiProfilu.mockResolvedValue({
      data: null,
      error: { code: "42703" },
    });
    expect(await requestAccountDeletion("USUŃ")).toEqual({
      ok: false,
      message: "Nie udało się usunąć konta. Spróbuj ponownie.",
    });
    expect(zapytania).toHaveLength(1);
    expect(remove).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("zero zmienionych wierszy → ten sam komunikat", async () => {
    wynikiProfilu.mockResolvedValue({ data: null, error: null });
    expect(await requestAccountDeletion("USUŃ")).toEqual({
      ok: false,
      message: "Nie udało się usunąć konta. Spróbuj ponownie.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sukces („ usuń ” małymi literami) → zapis, urządzenia push, zdjęcie, wylogowanie wszędzie i /logowanie?konto=usuniete", async () => {
    wynikiProfilu.mockResolvedValue({
      data: { avatar_path: "u1/zdjecie.webp" },
      error: null,
    });
    await expect(requestAccountDeletion(" usuń ")).rejects.toThrow(
      "REDIRECT:/logowanie?konto=usuniete",
    );

    expect(zapytania[0]).toMatchObject({
      tabela: "profiles",
      operacja: "update",
      eq: ["user_id", "u1"],
    });
    expect(
      typeof (zapytania[0].wartosci as { deletion_requested_at: unknown })
        .deletion_requested_at,
    ).toBe("string");
    // Błąd usuwania urządzeń (brak tabeli) nie przerywa
    expect(zapytania[1]).toEqual({
      tabela: "push_subscriptions",
      operacja: "delete",
      eq: ["user_id", "u1"],
    });
    expect(remove).toHaveBeenCalledWith(["u1/zdjecie.webp"]);
    expect(zapytania[2]).toEqual({
      tabela: "profiles",
      operacja: "update",
      wartosci: { avatar_path: null },
      eq: ["user_id", "u1"],
    });
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });

  it("bez zdjęcia → bez Storage", async () => {
    wynikiProfilu.mockResolvedValue({
      data: { avatar_path: null },
      error: null,
    });
    await expect(requestAccountDeletion("USUŃ")).rejects.toThrow(
      "REDIRECT:/logowanie?konto=usuniete",
    );
    expect(remove).not.toHaveBeenCalled();
    expect(zapytania).toHaveLength(2);
    expect(signOut).toHaveBeenCalledWith({ scope: "global" });
  });
});

describe("restoreAccount", () => {
  it("sukces → deletion_requested_at = null i /dzis", async () => {
    wynikiProfilu.mockResolvedValue({ data: { user_id: "u1" }, error: null });
    await expect(restoreAccount()).rejects.toThrow("REDIRECT:/dzis");
    expect(zapytania).toEqual([
      {
        tabela: "profiles",
        operacja: "update",
        wartosci: { deletion_requested_at: null },
        eq: ["user_id", "u1"],
      },
    ]);
  });

  it("błąd → komunikat", async () => {
    wynikiProfilu.mockResolvedValue({ data: null, error: { code: "500" } });
    expect(await restoreAccount()).toEqual({
      ok: false,
      message: "Nie udało się przywrócić konta. Spróbuj ponownie.",
    });
  });

  it("bez sesji → /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(restoreAccount()).rejects.toThrow("REDIRECT:/logowanie");
  });
});
