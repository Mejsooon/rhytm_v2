import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getUser,
  updateUser,
  signOut,
  resetPasswordForEmail,
  rpc,
  revalidatePath,
  isPasswordPwned,
} = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOut: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  rpc: vi.fn(),
  revalidatePath: vi.fn(),
  isPasswordPwned: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser, signOut, resetPasswordForEmail },
    rpc,
  }),
}));
vi.mock("@/lib/auth/hibp", () => ({ isPasswordPwned }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "localhost:3000" }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import {
  changePassword,
  requestEmailChange,
  revokeSession,
  sendSetPasswordLink,
  signOutOtherSessions,
} from "./account-actions";

describe("requestEmailChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "ala@example.com" } },
    });
    updateUser.mockResolvedValue({ error: null });
  });

  it("bez sesji → przekierowanie na /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(requestEmailChange("nowy@example.com")).rejects.toThrow(
      "REDIRECT:/logowanie",
    );
  });

  it("zły format → komunikat, bez updateUser", async () => {
    expect(await requestEmailChange("to-nie-adres")).toEqual({
      ok: false,
      message: "To nie wygląda na adres e-mail.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("ten sam adres (także wielkimi literami) → „To już jest Twój adres.”", async () => {
    expect(await requestEmailChange("  ALA@example.com ")).toEqual({
      ok: false,
      message: "To już jest Twój adres.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("zajęty adres", async () => {
    updateUser.mockResolvedValue({
      error: { code: "email_exists", status: 422, message: "x" },
    });
    expect(await requestEmailChange("zajety@example.com")).toEqual({
      ok: false,
      message: "Ten adres jest już zajęty.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("limit wysyłki", async () => {
    updateUser.mockResolvedValue({
      error: { code: "over_email_send_rate_limit", status: 429, message: "x" },
    });
    expect(await requestEmailChange("nowy@example.com")).toEqual({
      ok: false,
      message: "Za dużo prób. Spróbuj za chwilę.",
    });
  });

  it("inny błąd", async () => {
    updateUser.mockResolvedValue({
      error: { code: "unexpected_failure", status: 500, message: "x" },
    });
    expect(await requestEmailChange("nowy@example.com")).toEqual({
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    });
  });

  it("sukces → updateUser z przyciętym adresem małymi literami i revalidatePath", async () => {
    expect(await requestEmailChange("  Nowy@Example.com ")).toEqual({
      ok: true,
    });
    expect(updateUser).toHaveBeenCalledWith({ email: "nowy@example.com" });
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/ogolne");
  });
});

const UZYTKOWNIK_Z_HASLEM = {
  id: "u1",
  email: "ala@example.com",
  identities: [{ provider: "email" }],
};
const DOBRE = {
  current: "Stare-Haslo-123",
  next: "Nowe-Haslo-456",
  repeat: "Nowe-Haslo-456",
};

describe("changePassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: UZYTKOWNIK_Z_HASLEM } });
    isPasswordPwned.mockResolvedValue(false);
    rpc.mockResolvedValue({ data: true, error: null });
    updateUser.mockResolvedValue({ error: null });
    signOut.mockResolvedValue({ error: null });
  });

  it("konto tylko Google → komunikat, bez rpc", async () => {
    getUser.mockResolvedValue({
      data: {
        user: { ...UZYTKOWNIK_Z_HASLEM, identities: [{ provider: "google" }] },
      },
    });
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "To konto loguje się przez Google. Ustaw hasło linkiem z maila.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("za krótkie nowe hasło → komunikat schematu", async () => {
    const wynik = await changePassword({
      ...DOBRE,
      next: "krotkie1",
      repeat: "krotkie1",
    });
    expect(wynik).toEqual({
      ok: false,
      message: "Hasło musi mieć co najmniej 10 znaków",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("nowe = obecne → komunikat", async () => {
    expect(
      await changePassword({
        current: "Nowe-Haslo-456",
        next: "Nowe-Haslo-456",
        repeat: "Nowe-Haslo-456",
      }),
    ).toEqual({
      ok: false,
      message: "Nowe hasło musi różnić się od obecnego.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("hasło z wycieku → komunikat, bez rpc", async () => {
    isPasswordPwned.mockResolvedValue(true);
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("złe obecne hasło (rpc → false)", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "Obecne hasło jest nieprawidłowe.",
    });
    expect(rpc).toHaveBeenCalledWith("verify_my_password", {
      p_password: "Stare-Haslo-123",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("za dużo prób", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "P0001", message: "za_duzo_prob" },
    });
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "Za dużo nieudanych prób. Spróbuj za 15 minut.",
    });
  });

  it("stara baza bez funkcji (PGRST202)", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { code: "PGRST202", message: "Could not find the function" },
    });
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "Zmiana hasła będzie dostępna za chwilę. Spróbuj później.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("błąd updateUser → komunikat, bez wylogowania innych", async () => {
    updateUser.mockResolvedValue({ error: { status: 500, message: "x" } });
    expect(await changePassword(DOBRE)).toEqual({
      ok: false,
      message: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    });
    expect(signOut).not.toHaveBeenCalled();
  });

  it("sukces → updateUser z datą zmiany, wylogowanie innych i revalidatePath", async () => {
    expect(await changePassword(DOBRE)).toEqual({ ok: true });
    expect(updateUser).toHaveBeenCalledWith({
      password: "Nowe-Haslo-456",
      data: { password_changed_at: expect.any(String) },
    });
    const data = updateUser.mock.calls[0][0].data.password_changed_at;
    expect(Number.isNaN(Date.parse(data))).toBe(false);
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
    expect(revalidatePath).toHaveBeenCalledWith("/ustawienia/konto");
  });
});

describe("sendSetPasswordLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "u1",
          email: "ala@example.com",
          identities: [{ provider: "google" }],
        },
      },
    });
    resetPasswordForEmail.mockResolvedValue({ error: null });
  });

  it("wysyła link resetu na adres konta z powrotem do /auth/confirm", async () => {
    expect(await sendSetPasswordLink()).toEqual({
      ok: true,
      email: "ala@example.com",
    });
    expect(resetPasswordForEmail).toHaveBeenCalledWith("ala@example.com", {
      redirectTo: expect.stringMatching(/\/auth\/confirm$/),
    });
  });

  it("błąd → komunikat", async () => {
    resetPasswordForEmail.mockResolvedValue({
      error: { status: 500, message: "x" },
    });
    expect(await sendSetPasswordLink()).toEqual({
      ok: false,
      message: "Nie udało się wysłać linku. Spróbuj ponownie.",
    });
  });
});

describe("signOutOtherSessions i revokeSession", () => {
  const ID = "11111111-1111-4111-8111-111111111111";
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
  });

  it("„Wyloguj wszystkie inne” → signOut others", async () => {
    expect(await signOutOtherSessions()).toEqual({ ok: true });
    expect(signOut).toHaveBeenCalledWith({ scope: "others" });
  });

  it("revokeSession → rpc revoke_my_session", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await revokeSession(ID)).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("revoke_my_session", { p_session_id: ID });
  });

  it("revokeSession z false → „Ta sesja już wygasła.”", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    expect(await revokeSession(ID)).toEqual({
      ok: false,
      message: "Ta sesja już wygasła.",
    });
  });

  it("revokeSession z błędnym id → bez rpc", async () => {
    expect(await revokeSession("nie-uuid")).toEqual({
      ok: false,
      message: "Ta sesja już wygasła.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });
});
