import { beforeEach, describe, expect, it, vi } from "vitest";

const { signInWithPassword, maybeSingle, verifyTurnstile } = vi.hoisted(() => ({
  signInWithPassword: vi.fn(),
  maybeSingle: vi.fn(),
  verifyTurnstile: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { signInWithPassword },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("@/lib/auth/turnstile", () => ({ verifyTurnstile }));
vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8" }),
}));
// redirect w Next rzuca wyjątek — odwzorowujemy to, żeby sprawdzić cel
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { signIn } from "./actions";

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
