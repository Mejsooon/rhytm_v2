import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { verifyOtp } = vi.hoisted(() => ({ verifyOtp: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { verifyOtp } }),
}));

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
    verifyOtp.mockResolvedValue({ error: null });
  });

  it("signup → verifyOtp i 307 na /potwierdzono", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=signup"));
    expect(verifyOtp).toHaveBeenCalledWith({ type: "signup", token_hash: "abc" });
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

  it("email_change nie jest obsługiwany (jeszcze nie ma ustawień) → /link-wygasl", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=email_change"));
    expect(cel(res)).toBe("/link-wygasl?type=signup");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("ciasteczko rhytm_recovery ustawiane tylko po udanym recovery (httpOnly, lax, 900 s)", async () => {
    const res = await GET(zadanie("?token_hash=abc&type=recovery"));
    const c = res.cookies.get("rhytm_recovery");
    expect(c?.value).toBe("1");
    const naglowek = res.headers.get("set-cookie") ?? "";
    expect(naglowek).toMatch(/HttpOnly/i);
    expect(naglowek).toMatch(/SameSite=lax/i);
    expect(naglowek).toMatch(/Max-Age=900/i);
  });

  it("ciasteczka nie ma dla signup ani po błędzie recovery", async () => {
    const ok = await GET(zadanie("?token_hash=abc&type=signup"));
    expect(ok.cookies.get("rhytm_recovery")).toBeUndefined();
    verifyOtp.mockResolvedValue({ error: { message: "expired" } });
    const zle = await GET(zadanie("?token_hash=abc&type=recovery"));
    expect(zle.cookies.get("rhytm_recovery")).toBeUndefined();
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
