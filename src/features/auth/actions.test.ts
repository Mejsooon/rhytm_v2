import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  signInWithPassword,
  signUpMock,
  resendMock,
  resetForEmail,
  getUser,
  updateUser,
  signOutMock,
  cookieGet,
  cookieDelete,
  isPasswordPwned,
  maybeSingle,
  pushDelete,
} = vi.hoisted(() => ({
  pushDelete: vi.fn(),
  signInWithPassword: vi.fn(),
  signUpMock: vi.fn(),
  resendMock: vi.fn(),
  resetForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOutMock: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  isPasswordPwned: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      signUp: signUpMock,
      resend: resendMock,
      resetPasswordForEmail: resetForEmail,
      getUser,
      updateUser,
      signOut: signOutMock,
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle }) }),
      // signOut: usunięcie wiersza push tej przeglądarki
      delete: () => ({
        eq: async (kolumna: string, wartosc: string) => pushDelete(kolumna, wartosc),
      }),
    }),
  }),
}));
vi.mock("@/lib/auth/hibp", () => ({ isPasswordPwned }));
vi.mock("next/headers", () => ({
  headers: async () =>
    new Headers({
      "x-forwarded-for": "1.2.3.4, 5.6.7.8",
      host: "localhost:3000",
    }),
  cookies: async () => ({ get: cookieGet, delete: cookieDelete }),
}));
// redirect w Next rzuca wyjątek — odwzorowujemy to, żeby sprawdzić cel
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { utworzZnacznikResetu } from "@/lib/auth/recovery";

import {
  checkPasswordLeak,
  requestPasswordReset,
  resendConfirmation,
  resendLink,
  signIn,
  signOut,
  signUp,
  updatePassword,
} from "./actions";

function formularz(dane: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(dane)) fd.set(k, v);
  return fd;
}

const poprawne = {
  email: "a@b.pl",
  password: "haslo12345",
  "cf-turnstile-response": "tok",
};

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("przekazuje token do Supabase; captcha_failed → „Potwierdź, że nie jesteś botem”", async () => {
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", message: "captcha" } });
    const wynik = await signIn({ status: "idle" }, formularz(poprawne));
    expect(wynik).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "a@b.pl",
      password: "haslo12345",
      options: { captchaToken: "tok" },
    });
  });

  it("błąd autoryzacji → „Nieprawidłowy e-mail lub hasło”", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "Invalid login" },
    });
    const wynik = await signIn({ status: "idle" }, formularz(poprawne));
    expect(wynik).toEqual({
      status: "error",
      message: "Nieprawidłowy e-mail lub hasło",
    });
  });

  it("zły format e-maila → ten sam ogólny komunikat", async () => {
    const wynik = await signIn(
      { status: "idle" },
      formularz({ ...poprawne, email: "nie-email" }),
    );
    expect(wynik).toEqual({
      status: "error",
      message: "Nieprawidłowy e-mail lub hasło",
    });
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("sukces z ukończonym onboardingiem → przekierowanie na /dzis", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: { onboarded_at: "2026-11-16T10:00:00Z" },
    });
    await expect(
      signIn({ status: "idle" }, formularz(poprawne)),
    ).rejects.toThrow("REDIRECT:/dzis");
  });

  it("konto oznaczone do usunięcia → /konto-usuniete", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        onboarded_at: "2026-11-16T10:00:00Z",
        deletion_requested_at: "2026-11-24T10:00:00Z",
      },
      error: null,
    });
    await expect(
      signIn({ status: "idle" }, formularz(poprawne)),
    ).rejects.toThrow("REDIRECT:/konto-usuniete");
  });

  it("stara baza bez kolumny (42703) → drugie zapytanie, /dzis", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({
        data: { onboarded_at: "2026-11-16T10:00:00Z" },
        error: null,
      });
    await expect(
      signIn({ status: "idle" }, formularz(poprawne)),
    ).rejects.toThrow("REDIRECT:/dzis");
  });

  it("sukces bez onboardingu → /onboarding", async () => {
    signInWithPassword.mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    });
    maybeSingle.mockResolvedValue({ data: null });
    await expect(
      signIn({ status: "idle" }, formularz(poprawne)),
    ).rejects.toThrow("REDIRECT:/onboarding");
  });
});

const rejestracja = {
  displayName: "Ala",
  email: "Ala@Przyklad.pl",
  password: "rytm2026dobre",
  tos: "on",
  "cf-turnstile-response": "tok",
};

describe("signUp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isPasswordPwned.mockResolvedValue(false);
    signUpMock.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
  });

  it("brak zgody na regulamin → błąd pola tos, bez wywołania Supabase", async () => {
    const bezZgody: Record<string, string> = { ...rejestracja };
    delete bezZgody.tos;
    const wynik = await signUp({ status: "idle" }, formularz(bezZgody));
    expect(wynik.status).toBe("error");
    expect(wynik.fieldErrors?.tos).toBe("Zaakceptuj regulamin");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("captcha_failed → „Potwierdź, że nie jesteś botem”", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", message: "captcha" } });
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
  });

  it("hasło z wycieku → błąd, bez wywołania Supabase", async () => {
    isPasswordPwned.mockResolvedValue(true);
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik.status).toBe("error");
    expect(wynik.message).toContain("wyciek");
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it("sukces → signUp z imieniem i adresem powrotu, stan success z e-mailem", async () => {
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(signUpMock).toHaveBeenCalledWith({
      email: "ala@przyklad.pl",
      password: "rytm2026dobre",
      options: {
        data: { display_name: "Ala" },
        emailRedirectTo: "http://localhost:3000/auth/confirm",
        captchaToken: "tok",
      },
    });
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("istniejący użytkownik (błąd) daje ten sam stan sukcesu", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: {
        code: "user_already_exists",
        message: "User already registered",
      },
    });
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("inny błąd Supabase → ogólny komunikat", async () => {
    signUpMock.mockResolvedValue({
      data: { user: null },
      error: { code: "unexpected_failure", message: "boom" },
    });
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({
      status: "error",
      message: "Nie udało się założyć konta. Spróbuj ponownie.",
    });
  });
});

describe("checkPasswordLeak", () => {
  it("przekazuje wynik isPasswordPwned", async () => {
    isPasswordPwned.mockResolvedValue(true);
    expect(await checkPasswordLeak("haslo1234")).toBe(true);
    isPasswordPwned.mockResolvedValue(false);
    expect(await checkPasswordLeak("rytm2026dobre")).toBe(false);
  });
});

describe("resendConfirmation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("zły e-mail → błąd pola, bez wysyłki", async () => {
    const wynik = await resendConfirmation("nie-email", "tok");
    expect(wynik.fieldErrors?.email).toBe("Podaj poprawny e-mail");
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("captcha_failed → „Potwierdź, że nie jesteś botem”", async () => {
    resendMock.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", message: "captcha" } });
    expect(await resendConfirmation("ala@przyklad.pl", null)).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
  });

  it("wysyła ponownie link i zwraca sukces", async () => {
    resendMock.mockResolvedValue({ error: null });
    const wynik = await resendConfirmation("ala@przyklad.pl", "tok");
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ala@przyklad.pl",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm",
        captchaToken: "tok",
      },
    });
    expect(wynik.status).toBe("success");
  });

  it("błąd Supabase nie zdradza stanu konta — też sukces", async () => {
    resendMock.mockResolvedValue({ error: { message: "x" } });
    expect((await resendConfirmation("ala@przyklad.pl", "tok")).status).toBe(
      "success",
    );
  });
});

describe("adres powrotny (NEXT_PUBLIC_SITE_URL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resendMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("używa NEXT_PUBLIC_SITE_URL (bez końcowego ukośnika), ignorując nagłówki", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rhytm.app/");
    await resendConfirmation("a@b.pl", "tok");
    expect(resendMock.mock.calls[0][0].options.emailRedirectTo).toBe(
      "https://rhytm.app/auth/confirm",
    );
  });

  it("bez zmiennej poza produkcją — zapas z nagłówków", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    await resendConfirmation("a@b.pl", "tok");
    expect(resendMock.mock.calls[0][0].options.emailRedirectTo).toBe(
      "http://localhost:3000/auth/confirm",
    );
  });

  it("w produkcji bez zmiennej — czytelny błąd, bez wysyłki", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(resendConfirmation("a@b.pl", "tok")).rejects.toThrow(
      "NEXT_PUBLIC_SITE_URL",
    );
    expect(resendMock).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetForEmail.mockResolvedValue({ error: null });
  });

  it("wysyła link i zwraca sukces z e-mailem", async () => {
    const wynik = await requestPasswordReset(
      { status: "idle" },
      formularz({ email: " Ala@Przyklad.pl ", "cf-turnstile-response": "tok" }),
    );
    expect(resetForEmail).toHaveBeenCalledWith("ala@przyklad.pl", {
      redirectTo: "http://localhost:3000/auth/confirm",
      captchaToken: "tok",
    });
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("błąd Supabase (np. brak konta) daje ten sam sukces", async () => {
    resetForEmail.mockResolvedValue({ error: { message: "User not found" } });
    const wynik = await requestPasswordReset(
      { status: "idle" },
      formularz({ email: "ala@przyklad.pl", "cf-turnstile-response": "tok" }),
    );
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("captcha_failed → komunikat o bocie", async () => {
    resetForEmail.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", message: "captcha" } });
    const wynik = await requestPasswordReset(
      { status: "idle" },
      formularz({ email: "ala@przyklad.pl" }),
    );
    expect(wynik).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
  });

  it("zły format e-maila → błąd pola", async () => {
    const wynik = await requestPasswordReset(
      { status: "idle" },
      formularz({ email: "nie-email", "cf-turnstile-response": "tok" }),
    );
    expect(wynik.status).toBe("error");
    expect(wynik.fieldErrors?.email).toBeTruthy();
    expect(resetForEmail).not.toHaveBeenCalled();
  });
});

describe("updatePassword", () => {
  const dane = { password: "rytm2026dobre", confirm: "rytm2026dobre" };
  const WYGASL = { status: "error", message: "Link wygasł. Poproś o nowy." };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "sekret-testowy");
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    // Podpisany znacznik z /auth/confirm dla u1
    cookieGet.mockReturnValue({
      name: "rhytm_recovery",
      value: utworzZnacznikResetu("u1"),
    });
    isPasswordPwned.mockResolvedValue(false);
    updateUser.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("sukces → updateUser, signOut(others), znacznik skasowany (jednorazowy), redirect na /dzis", async () => {
    await expect(
      updatePassword({ status: "idle" }, formularz(dane)),
    ).rejects.toThrow("REDIRECT:/dzis");
    expect(updateUser).toHaveBeenCalledWith({ password: "rytm2026dobre" });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
    expect(cookieDelete).toHaveBeenCalledWith("rhytm_recovery");
  });

  it("bez ciasteczka → „Link wygasł”, bez HIBP i zmiany", async () => {
    cookieGet.mockReturnValue(undefined);
    expect(await updatePassword({ status: "idle" }, formularz(dane))).toEqual(
      WYGASL,
    );
    expect(isPasswordPwned).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("podrobione ciasteczko „1” (stary format) → „Link wygasł”, bez HIBP", async () => {
    cookieGet.mockReturnValue({ name: "rhytm_recovery", value: "1" });
    expect(await updatePassword({ status: "idle" }, formularz(dane))).toEqual(
      WYGASL,
    );
    expect(isPasswordPwned).not.toHaveBeenCalled();
  });

  it("znacznik innego użytkownika → „Link wygasł”", async () => {
    cookieGet.mockReturnValue({
      name: "rhytm_recovery",
      value: utworzZnacznikResetu("u2"),
    });
    expect(await updatePassword({ status: "idle" }, formularz(dane))).toEqual(
      WYGASL,
    );
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("wygasły znacznik (sprzed 16 minut) → „Link wygasł”", async () => {
    cookieGet.mockReturnValue({
      name: "rhytm_recovery",
      value: utworzZnacznikResetu("u1", Date.now() - 16 * 60_000),
    });
    expect(await updatePassword({ status: "idle" }, formularz(dane))).toEqual(
      WYGASL,
    );
    expect(isPasswordPwned).not.toHaveBeenCalled();
  });

  it("brak sesji → „Link wygasł”, bez HIBP i zmiany", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await updatePassword({ status: "idle" }, formularz(dane))).toEqual(
      WYGASL,
    );
    expect(isPasswordPwned).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("niezgodne hasła → błąd pola confirm", async () => {
    const wynik = await updatePassword(
      { status: "idle" },
      formularz({ password: "rytm2026dobre", confirm: "inne" }),
    );
    expect(wynik.fieldErrors?.confirm).toBe("Hasła nie są takie same");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("hasło z wycieku → komunikat, bez zmiany", async () => {
    isPasswordPwned.mockResolvedValue(true);
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({
      status: "error",
      message: "To hasło wystąpiło w wyciekach danych. Wybierz inne.",
    });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("błąd updateUser → ogólny komunikat, bez wylogowania innych sesji i bez kasowania znacznika", async () => {
    updateUser.mockResolvedValue({ error: { message: "boom" } });
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({
      status: "error",
      message: "Nie udało się zmienić hasła. Spróbuj ponownie.",
    });
    expect(signOutMock).not.toHaveBeenCalled();
    expect(cookieDelete).not.toHaveBeenCalled();
  });
});

describe("resendLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resendMock.mockResolvedValue({ error: null });
    resetForEmail.mockResolvedValue({ error: null });
  });

  it("signup → resend potwierdzenia", async () => {
    const wynik = await resendLink("signup", "Ala@Przyklad.pl", "tok");
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ala@przyklad.pl",
      options: {
        emailRedirectTo: "http://localhost:3000/auth/confirm",
        captchaToken: "tok",
      },
    });
    expect(wynik.status).toBe("success");
  });

  it("recovery → resetPasswordForEmail, zawsze sukces", async () => {
    resetForEmail.mockResolvedValue({ error: { message: "x" } });
    const wynik = await resendLink("recovery", "ala@przyklad.pl", "tok");
    expect(resetForEmail).toHaveBeenCalledWith("ala@przyklad.pl", {
      redirectTo: "http://localhost:3000/auth/confirm",
      captchaToken: "tok",
    });
    expect(wynik.status).toBe("success");
  });

  it("recovery: zły e-mail → błąd pola, captcha_failed → komunikat", async () => {
    expect(
      (await resendLink("recovery", "zle", "tok")).fieldErrors?.email,
    ).toBe("Podaj poprawny e-mail");
    expect(resetForEmail).not.toHaveBeenCalled();
    resetForEmail.mockResolvedValue({ data: { user: null }, error: { code: "captcha_failed", message: "captcha" } });
    expect(await resendLink("recovery", "ala@przyklad.pl", null)).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
  });
});

describe("signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOutMock.mockResolvedValue({ error: null });
    pushDelete.mockResolvedValue({ error: null });
  });

  it("z endpointem push → usuwa wiersz urządzenia przed wylogowaniem", async () => {
    const fd = new FormData();
    fd.set("push_endpoint", "https://fcm.googleapis.com/fcm/send/abc");
    await expect(signOut(fd)).rejects.toThrow("REDIRECT:/logowanie");
    expect(pushDelete).toHaveBeenCalledWith(
      "endpoint",
      "https://fcm.googleapis.com/fcm/send/abc",
    );
    expect(pushDelete.mock.invocationCallOrder[0]).toBeLessThan(
      signOutMock.mock.invocationCallOrder[0],
    );
  });

  it("bez endpointu → samo wylogowanie", async () => {
    await expect(signOut(new FormData())).rejects.toThrow("REDIRECT:/logowanie");
    expect(pushDelete).not.toHaveBeenCalled();
    expect(signOutMock).toHaveBeenCalled();
  });

  it("błąd usuwania nie blokuje wylogowania", async () => {
    pushDelete.mockRejectedValue(new Error("sieć"));
    const fd = new FormData();
    fd.set("push_endpoint", "https://fcm.googleapis.com/fcm/send/abc");
    await expect(signOut(fd)).rejects.toThrow("REDIRECT:/logowanie");
    expect(signOutMock).toHaveBeenCalled();
  });
});
