import { beforeEach, describe, expect, it, vi } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const createServerClient = vi.fn((..._args: unknown[]) => ({}));
let userAgent: string | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: (...args: unknown[]) =>
    (createServerClient as (...a: unknown[]) => unknown)(...args),
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ getAll: () => [], set: () => {} }),
  headers: async () => ({
    get: (nazwa: string) => (nazwa === "user-agent" ? userAgent : null),
  }),
}));

import { createClient } from "./server";

describe("createClient (serwer)", () => {
  beforeEach(() => {
    createServerClient.mockClear();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:54321";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "klucz";
  });

  it("przekazuje user-agent przeglądarki do Supabase (sesja w auth.sessions)", async () => {
    userAgent = "Mozilla/5.0 (iPhone) Safari/604.1";
    await createClient();
    const opcje = createServerClient.mock.calls[0][2] as {
      global?: { headers?: Record<string, string> };
    };
    expect(opcje.global?.headers?.["User-Agent"]).toBe(userAgent);
  });

  it("bez nagłówka user-agent nie ustawia własnego", async () => {
    userAgent = null;
    await createClient();
    const opcje = createServerClient.mock.calls[0][2] as {
      global?: unknown;
    };
    expect(opcje.global).toBeUndefined();
  });
});
