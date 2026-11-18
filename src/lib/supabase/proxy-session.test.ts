import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Przechwytujemy opcje cookies przekazane do createServerClient, żeby wywołać setAll jak biblioteka
type OpcjeCookies = {
  setAll: (
    c: { name: string; value: string; options: Record<string, unknown> }[],
    h: Record<string, string>,
  ) => void;
};
const { stan, getUser } = vi.hoisted(() => ({
  stan: {
    cookies: null as OpcjeCookies | null,
    przyGetUser: (() => {}) as () => void,
  },
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: (
    _url: string,
    _key: string,
    opcje: { cookies: OpcjeCookies },
  ) => {
    stan.cookies = opcje.cookies;
    return { auth: { getUser } };
  },
}));

import { updateSession } from "./proxy-session";

const NAGLOWKI_SUPABASE = {
  "Cache-Control": "private, no-cache, no-store, must-revalidate, max-age=0",
  Expires: "0",
  Pragma: "no-cache",
};

describe("updateSession", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "klucz";
    getUser.mockImplementation(async () => {
      stan.przyGetUser();
      return { data: { user: { id: "u1" } } };
    });
  });

  it("nagłówki przekazane do setAll (Cache-Control, Expires, Pragma) trafiają na odpowiedź razem z ciasteczkami", async () => {
    stan.przyGetUser = () =>
      stan.cookies!.setAll(
        [{ name: "sb-token", value: "nowy", options: { path: "/" } }],
        NAGLOWKI_SUPABASE,
      );
    const { response } = await updateSession(
      new NextRequest("http://localhost:3000/dzis"),
    );
    expect(response.cookies.get("sb-token")?.value).toBe("nowy");
    expect(response.headers.get("cache-control")).toBe(
      NAGLOWKI_SUPABASE["Cache-Control"],
    );
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
  });

  it("drugie wywołanie setAll (z pustymi nagłówkami) nie gubi nagłówków z pierwszego", async () => {
    stan.przyGetUser = () => {
      stan.cookies!.setAll(
        [{ name: "a", value: "1", options: {} }],
        NAGLOWKI_SUPABASE,
      );
      stan.cookies!.setAll([{ name: "b", value: "2", options: {} }], {});
    };
    const { response } = await updateSession(
      new NextRequest("http://localhost:3000/dzis"),
    );
    expect(response.cookies.get("b")?.value).toBe("2");
    expect(response.headers.get("cache-control")).toBe(
      NAGLOWKI_SUPABASE["Cache-Control"],
    );
  });

  it("bez zapisu ciasteczek odpowiedź nie dostaje nagłówków no-cache", async () => {
    stan.przyGetUser = () => {};
    const { response } = await updateSession(
      new NextRequest("http://localhost:3000/dzis"),
    );
    expect(response.headers.get("cache-control")).toBeNull();
  });
});
