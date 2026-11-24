import { NextRequest, NextResponse } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { updateSession, maybeSingle, select } = vi.hoisted(() => ({
  updateSession: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/proxy-session", () => ({ updateSession }));

import { proxy } from "./proxy";

// Odpowiedź z updateSession: ciasteczko sesji i nagłówki no-cache od Supabase
function odpowiedzSesji() {
  const response = NextResponse.next();
  response.cookies.set("sb-token", "nowy");
  response.headers.set(
    "Cache-Control",
    "private, no-cache, no-store, must-revalidate, max-age=0",
  );
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function zalogowany() {
  const response = odpowiedzSesji();
  updateSession.mockResolvedValue({
    response,
    user: { id: "u1" },
    supabase: {
      from: () => ({
        select: (kolumny: string) => {
          select(kolumny);
          return { eq: () => ({ maybeSingle }) };
        },
      }),
    },
  });
  return response;
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "klucz";
  });

  it("błąd zapytania o profil → przepuszcza /dzis i /onboarding (bez odbijania między nimi)", async () => {
    const response = zalogowany();
    maybeSingle.mockResolvedValue({
      data: null,
      error: { message: "timeout" },
    });
    expect(await proxy(new NextRequest("http://localhost:3000/dzis"))).toBe(
      response,
    );
    expect(
      await proxy(new NextRequest("http://localhost:3000/onboarding")),
    ).toBe(response);
  });

  it("bez profilu z onboardingiem → /onboarding", async () => {
    zalogowany();
    maybeSingle.mockResolvedValue({
      data: { onboarded_at: null },
      error: null,
    });
    const res = await proxy(new NextRequest("http://localhost:3000/dzis"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });

  it("przekierowanie niesie ciasteczka sesji i nagłówki no-cache z updateSession", async () => {
    zalogowany();
    maybeSingle.mockResolvedValue({
      data: { onboarded_at: "2026-11-16T10:00:00Z" },
      error: null,
    });
    const res = await proxy(new NextRequest("http://localhost:3000/logowanie"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/dzis");
    expect(res.cookies.get("sb-token")?.value).toBe("nowy");
    expect(res.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0",
    );
    expect(res.headers.get("expires")).toBe("0");
    expect(res.headers.get("pragma")).toBe("no-cache");
  });
  it("konto oznaczone do usunięcia → /konto-usuniete", async () => {
    zalogowany();
    maybeSingle.mockResolvedValue({
      data: {
        onboarded_at: "2026-11-16T10:00:00Z",
        deletion_requested_at: "2026-11-24T10:00:00Z",
      },
      error: null,
    });
    const res = await proxy(new NextRequest("http://localhost:3000/dzis"));
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/konto-usuniete",
    );
    expect(select).toHaveBeenCalledWith("onboarded_at, deletion_requested_at");
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("stara baza bez kolumny (42703) → drugie zapytanie bez niej, bez przekierowania na /konto-usuniete", async () => {
    const response = zalogowany();
    maybeSingle
      .mockResolvedValueOnce({
        data: null,
        error: { code: "42703", message: "column does not exist" },
      })
      .mockResolvedValueOnce({
        data: { onboarded_at: "2026-11-16T10:00:00Z" },
        error: null,
      });
    expect(await proxy(new NextRequest("http://localhost:3000/dzis"))).toBe(
      response,
    );
    expect(select).toHaveBeenNthCalledWith(
      1,
      "onboarded_at, deletion_requested_at",
    );
    expect(select).toHaveBeenNthCalledWith(2, "onboarded_at");
  });

  it("stara baza: drugie zapytanie też bez onboardingu → /onboarding", async () => {
    zalogowany();
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({ data: { onboarded_at: null }, error: null });
    const res = await proxy(new NextRequest("http://localhost:3000/dzis"));
    expect(new URL(res.headers.get("location")!).pathname).toBe("/onboarding");
  });
});
