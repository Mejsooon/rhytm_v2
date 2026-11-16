import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, signUpMock, resendMock, resetForEmail, getUser, getClaims, updateUser, signOutMock, isPasswordPwned, maybeSingle, verifyTurnstile } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  signUpMock: vi.fn(),
  resendMock: vi.fn(),
  resetForEmail: vi.fn(),
  getUser: vi.fn(),
  updateUser: vi.fn(),
  signOutMock: vi.fn(),
  getClaims: vi.fn(),
  isPasswordPwned: vi.fn(),
  maybeSingle: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      signInWithPassword,
      signUp: signUpMock,
      resend: resendMock,
      resetPasswordForEmail: resetForEmail,
      getUser,
      getClaims,
      updateUser,
      signOut: signOutMock,
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/auth/turnstile", () => ({ verifyTurnstile }));
vi.mock("@/lib/auth/hibp", () => ({ isPasswordPwned }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8", host: "localhost:3000" }),
}));
// redirect w Next rzuca wyjątek — odwzorowujemy to, żeby sprawdzić cel
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { checkPasswordLeak, requestPasswordReset, resendConfirmation, resendLink, signIn, signUp, updatePassword } from "./actions";

function formularz(dane: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(dane)) fd.set(k, v);
  return fd;
}

const poprawne = { email: "a@b.pl", password: "haslo12345", "cf-turnstile-response": "tok" };

describe("signIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("błąd Turnstile → „Potwierdź, że nie jesteś botem” (bez próby logowania)", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const wynik = await signIn({ status: "idle" }, formularz(poprawne));
    expect(wynik).toEqual({ status: "error", message: "Potwierdź, że nie jesteś botem" });
    expect(verifyTurnstile).toHaveBeenCalledWith("tok", "1.2.3.4");
    expect(signInWithPassword).not.toHaveBeenCalled();
  });

  it("błąd autoryzacji → „Nieprawidłowy e-mail lub hasło”", async () => {
    verifyTurnstile.mockResolvedValue(true);
    signInWithPassword.mockResolvedValue({ data: { user: null }, error: { message: "Invalid login" } });
    const wynik = await signIn({ status: "idle" }, formularz(poprawne));
    expect(wynik).toEqual({ status: "error", message: "Nieprawidłowy e-mail lub hasło" });
  });

  it("zły format e-maila → ten sam ogólny komunikat", async () => {
    const wynik = await signIn({ status: "idle" }, formularz({ ...poprawne, email: "nie-email" }));
    expect(wynik).toEqual({ status: "error", message: "Nieprawidłowy e-mail lub hasło" });
    expect(verifyTurnstile).not.toHaveBeenCalled();
  });

  it("sukces z ukończonym onboardingiem → przekierowanie na /dzis", async () => {
    verifyTurnstile.mockResolvedValue(true);
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: { onboarded_at: "2026-11-16T10:00:00Z" } });
    await expect(signIn({ status: "idle" }, formularz(poprawne))).rejects.toThrow("REDIRECT:/dzis");
  });

  it("sukces bez onboardingu → /onboarding", async () => {
    verifyTurnstile.mockResolvedValue(true);
    signInWithPassword.mockResolvedValue({ data: { user: { id: "u1" } }, error: null });
    maybeSingle.mockResolvedValue({ data: null });
    await expect(signIn({ status: "idle" }, formularz(poprawne))).rejects.toThrow("REDIRECT:/onboarding");
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
    verifyTurnstile.mockResolvedValue(true);
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

  it("błąd Turnstile → „Potwierdź, że nie jesteś botem”", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({ status: "error", message: "Potwierdź, że nie jesteś botem" });
    expect(signUpMock).not.toHaveBeenCalled();
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
      options: { data: { display_name: "Ala" }, emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("istniejący użytkownik (błąd) daje ten sam stan sukcesu", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { code: "user_already_exists", message: "User already registered" } });
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("inny błąd Supabase → ogólny komunikat", async () => {
    signUpMock.mockResolvedValue({ data: { user: null }, error: { code: "unexpected_failure", message: "boom" } });
    const wynik = await signUp({ status: "idle" }, formularz(rejestracja));
    expect(wynik).toEqual({ status: "error", message: "Nie udało się założyć konta. Spróbuj ponownie." });
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
    verifyTurnstile.mockResolvedValue(true);
  });

  it("zły e-mail → błąd pola, bez wysyłki", async () => {
    const wynik = await resendConfirmation("nie-email", "tok");
    expect(wynik.fieldErrors?.email).toBe("Podaj poprawny e-mail");
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("błąd Turnstile → „Potwierdź, że nie jesteś botem”, bez wysyłki", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const wynik = await resendConfirmation("ala@przyklad.pl", null);
    expect(wynik).toEqual({ status: "error", message: "Potwierdź, że nie jesteś botem" });
    expect(verifyTurnstile).toHaveBeenCalledWith(null, "1.2.3.4");
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("wysyła ponownie link i zwraca sukces", async () => {
    resendMock.mockResolvedValue({ error: null });
    const wynik = await resendConfirmation("ala@przyklad.pl", "tok");
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ala@przyklad.pl",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(wynik.status).toBe("success");
  });

  it("błąd Supabase nie zdradza stanu konta — też sukces", async () => {
    resendMock.mockResolvedValue({ error: { message: "x" } });
    expect((await resendConfirmation("ala@przyklad.pl", "tok")).status).toBe("success");
  });
});

describe("adres powrotny (NEXT_PUBLIC_SITE_URL)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstile.mockResolvedValue(true);
    resendMock.mockResolvedValue({ error: null });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("używa NEXT_PUBLIC_SITE_URL (bez końcowego ukośnika), ignorując nagłówki", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://rhytm.app/");
    await resendConfirmation("a@b.pl", "tok");
    expect(resendMock.mock.calls[0][0].options.emailRedirectTo).toBe("https://rhytm.app/auth/confirm");
  });

  it("bez zmiennej poza produkcją — zapas z nagłówków", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    await resendConfirmation("a@b.pl", "tok");
    expect(resendMock.mock.calls[0][0].options.emailRedirectTo).toBe("http://localhost:3000/auth/confirm");
  });

  it("w produkcji bez zmiennej — czytelny błąd, bez wysyłki", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(resendConfirmation("a@b.pl", "tok")).rejects.toThrow("NEXT_PUBLIC_SITE_URL");
    expect(resendMock).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstile.mockResolvedValue(true);
    resetForEmail.mockResolvedValue({ error: null });
  });

  it("wysyła link i zwraca sukces z e-mailem", async () => {
    const wynik = await requestPasswordReset({ status: "idle" }, formularz({ email: " Ala@Przyklad.pl ", "cf-turnstile-response": "tok" }));
    expect(resetForEmail).toHaveBeenCalledWith("ala@przyklad.pl", { redirectTo: "http://localhost:3000/auth/confirm" });
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("błąd Supabase (np. brak konta) daje ten sam sukces", async () => {
    resetForEmail.mockResolvedValue({ error: { message: "User not found" } });
    const wynik = await requestPasswordReset({ status: "idle" }, formularz({ email: "ala@przyklad.pl", "cf-turnstile-response": "tok" }));
    expect(wynik).toEqual({ status: "success", email: "ala@przyklad.pl" });
  });

  it("błąd Turnstile → komunikat, bez wysyłki", async () => {
    verifyTurnstile.mockResolvedValue(false);
    const wynik = await requestPasswordReset({ status: "idle" }, formularz({ email: "ala@przyklad.pl" }));
    expect(wynik).toEqual({ status: "error", message: "Potwierdź, że nie jesteś botem" });
    expect(resetForEmail).not.toHaveBeenCalled();
  });

  it("zły format e-maila → błąd pola", async () => {
    const wynik = await requestPasswordReset({ status: "idle" }, formularz({ email: "nie-email", "cf-turnstile-response": "tok" }));
    expect(wynik.status).toBe("error");
    expect(wynik.fieldErrors?.email).toBeTruthy();
    expect(resetForEmail).not.toHaveBeenCalled();
  });
});

describe("updatePassword", () => {
  const dane = { password: "rytm2026dobre", confirm: "rytm2026dobre" };
  // Sesja z linku resetu: JWT z wpisem amr „recovery” sprzed minuty
  const sesjaResetu = (sekundTemu: number) => ({
    data: { claims: { sub: "u1", amr: [{ method: "recovery", timestamp: Math.floor(Date.now() / 1000) - sekundTemu }] } },
    error: null,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getClaims.mockResolvedValue(sesjaResetu(60));
    isPasswordPwned.mockResolvedValue(false);
    updateUser.mockResolvedValue({ error: null });
    signOutMock.mockResolvedValue({ error: null });
  });

  it("sukces → updateUser, signOut(others), redirect na /dzis", async () => {
    await expect(updatePassword({ status: "idle" }, formularz(dane))).rejects.toThrow("REDIRECT:/dzis");
    expect(updateUser).toHaveBeenCalledWith({ password: "rytm2026dobre" });
    expect(signOutMock).toHaveBeenCalledWith({ scope: "others" });
  });

  it("zwykła sesja (amr bez recovery) → „Link wygasł”, bez HIBP i zmiany", async () => {
    getClaims.mockResolvedValue({
      data: { claims: { sub: "u1", amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] } },
      error: null,
    });
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({ status: "error", message: "Link wygasł. Poproś o nowy." });
    expect(isPasswordPwned).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("recovery starszy niż 15 minut → „Link wygasł”, bez HIBP", async () => {
    getClaims.mockResolvedValue(sesjaResetu(16 * 60));
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik.message).toBe("Link wygasł. Poproś o nowy.");
    expect(isPasswordPwned).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("brak sesji (getClaims bez danych) → „Link wygasł”, bez HIBP i zmiany", async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({ status: "error", message: "Link wygasł. Poproś o nowy." });
    expect(isPasswordPwned).not.toHaveBeenCalled();
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("niezgodne hasła → błąd pola confirm", async () => {
    const wynik = await updatePassword({ status: "idle" }, formularz({ password: "rytm2026dobre", confirm: "inne" }));
    expect(wynik.fieldErrors?.confirm).toBe("Hasła nie są takie same");
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("hasło z wycieku → komunikat, bez zmiany", async () => {
    isPasswordPwned.mockResolvedValue(true);
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({ status: "error", message: "To hasło wystąpiło w wyciekach danych. Wybierz inne." });
    expect(updateUser).not.toHaveBeenCalled();
  });

  it("błąd updateUser → ogólny komunikat, bez wylogowania innych sesji", async () => {
    updateUser.mockResolvedValue({ error: { message: "boom" } });
    const wynik = await updatePassword({ status: "idle" }, formularz(dane));
    expect(wynik).toEqual({ status: "error", message: "Nie udało się zmienić hasła. Spróbuj ponownie." });
    expect(signOutMock).not.toHaveBeenCalled();
  });
});

describe("resendLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyTurnstile.mockResolvedValue(true);
    resendMock.mockResolvedValue({ error: null });
    resetForEmail.mockResolvedValue({ error: null });
  });

  it("signup → resend potwierdzenia", async () => {
    const wynik = await resendLink("signup", "Ala@Przyklad.pl", "tok");
    expect(resendMock).toHaveBeenCalledWith({
      type: "signup",
      email: "ala@przyklad.pl",
      options: { emailRedirectTo: "http://localhost:3000/auth/confirm" },
    });
    expect(wynik.status).toBe("success");
  });

  it("recovery → resetPasswordForEmail, zawsze sukces", async () => {
    resetForEmail.mockResolvedValue({ error: { message: "x" } });
    const wynik = await resendLink("recovery", "ala@przyklad.pl", "tok");
    expect(resetForEmail).toHaveBeenCalledWith("ala@przyklad.pl", { redirectTo: "http://localhost:3000/auth/confirm" });
    expect(wynik.status).toBe("success");
  });

  it("recovery: zły e-mail → błąd pola, błąd Turnstile → komunikat; w obu bez wysyłki", async () => {
    expect((await resendLink("recovery", "zle", "tok")).fieldErrors?.email).toBe("Podaj poprawny e-mail");
    verifyTurnstile.mockResolvedValue(false);
    expect(await resendLink("recovery", "ala@przyklad.pl", null)).toEqual({
      status: "error",
      message: "Potwierdź, że nie jesteś botem",
    });
    expect(resetForEmail).not.toHaveBeenCalled();
  });
});
