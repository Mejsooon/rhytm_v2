import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

import { znacznikResetuPasuje } from "@/lib/auth/recovery";

import { GET } from "./route";

function zadanie(query: string) {
  return new NextRequest(`http://localhost:3000/auth/confirm${query}`);
}

function cel(res: Response) {
  const location = res.headers.get("location");
  if (!location) throw new Error("brak nagłówka location");
  const url = new URL(location);
  return url.pathname + url.search;
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RECOVERY_COOKIE_SECRET", "sekret-testowy");
    verifyOtp.mockResolvedValue({
      data: { user: { id: "u1" }, session: {} },
      error: null,
    });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("signup → verifyOtp i 307 na /potwierdzono", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=signup"));
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "signup",
      token_hash: "abc",
    });
    expect(res.status).toBe(307);
    expect(cel(res)).toBe("/potwierdzono");
  });

  it("email → /potwierdzono", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=email"));
    expect(cel(res)).toBe("/potwierdzono");
  });

  it("recovery → /nowe-haslo", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=recovery"));
    expect(res.status).toBe(307);
    expect(cel(res)).toBe("/nowe-haslo");
  });

  it("email_change → verifyOtp i /ustawienia/konto?email=potwierdzono", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=email_change"));
    expect(verifyOtp).toHaveBeenCalledWith({
      type: "email_change",
      token_hash: "abc",
    });
    expect(res.status).toBe(307);
    expect(cel(res)).toBe("/ustawienia/konto?email=potwierdzono");
  });

  it("email_change z błędem verifyOtp → /link-wygasl?type=signup", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(zadanie("?token_hash=abc&type=email_change"));
    expect(cel(res)).toBe("/link-wygasl?type=signup");
  });

  it("recovery: podpisane ciasteczko rhytm_recovery dla użytkownika z verifyOtp (httpOnly, lax, /, 900 s)", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=recovery"));
    const wartosc = res.cookies.get("rhytm_recovery")?.value;
    expect(znacznikResetuPasuje(wartosc, "u1")).toBe(true);
    expect(znacznikResetuPasuje(wartosc, "u2")).toBe(false);
    const naglowek = res.headers.get("set-cookie") ?? "";
    expect(naglowek).toMatch(/HttpOnly/i);
    expect(naglowek).toMatch(/SameSite=lax/i);
    expect(naglowek).toMatch(/Path=\//i);
    expect(naglowek).toMatch(/Max-Age=900/i);
  });

  it("ciasteczka nie ma dla signup, po błędzie recovery ani bez użytkownika w wyniku", async () => {
    const ok = await GET(zadanie("?token_hash=abc&type=signup"));
    expect(ok.cookies.get("rhytm_recovery")).toBeUndefined();
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: "expired" },
    });
    const zle = await GET(zadanie("?token_hash=abc&type=recovery"));
    expect(zle.cookies.get("rhytm_recovery")).toBeUndefined();
    verifyOtp.mockResolvedValue({
      data: { user: null, session: null },
      error: null,
    });
    const bezUzytkownika = await GET(zadanie("?token_hash=abc&type=recovery"));
    expect(bezUzytkownika.cookies.get("rhytm_recovery")).toBeUndefined();
    expect(cel(bezUzytkownika)).toBe("/link-wygasl?type=recovery");
  });

  it("błąd verifyOtp → /link-wygasl?type=signup", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "Token has expired" } });
    const res = await GET(zadanie("?token_hash=abc&type=signup"));
    expect(cel(res)).toBe("/link-wygasl?type=signup");
  });

  it("błąd przy recovery zachowuje type=recovery", async () => {
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const res = await GET(zadanie("?token_hash=abc&type=recovery"));
    expect(cel(res)).toBe("/link-wygasl?type=recovery");
  });

  it("brak token_hash → /link-wygasl?type=signup, bez wołania Supabase", async () => {
    const res = await GET(zadanie("?type=signup"));
    expect(cel(res)).toBe("/link-wygasl?type=signup");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("nieznany type nie trafia do przekierowania ani do verifyOtp", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=https://zlosliwy.pl"));
    expect(cel(res)).toBe("/link-wygasl?type=signup");
    expect(verifyOtp).not.toHaveBeenCalled();
  });
});
