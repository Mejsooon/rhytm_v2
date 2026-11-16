import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, update, eq, is } = vi.hoisted(() => ({
  getUser: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from: () => ({ update }) }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { ukonczOnboarding } from "./actions";

describe("ukonczOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    update.mockReturnValue({ eq });
    eq.mockReturnValue({ is });
    is.mockResolvedValue({ error: null });
  });

  it("aktualizuje tylko nieukończony onboarding (onboarded_at is null) i przechodzi na /dzis", async () => {
    await expect(ukonczOnboarding()).rejects.toThrow("REDIRECT:/dzis");
    expect(update).toHaveBeenCalledWith({ onboarded_at: expect.any(String) });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
    expect(is).toHaveBeenCalledWith("onboarded_at", null);
  });

  it("błąd zapisu → stan błędu zamiast przekierowania", async () => {
    is.mockResolvedValue({ error: { message: "boom" } });
    const wynik = await ukonczOnboarding();
    expect(wynik).toEqual({ status: "error", message: "Nie udało się zapisać. Spróbuj ponownie." });
  });

  it("bez sesji → /logowanie, bez zapisu", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(ukonczOnboarding()).rejects.toThrow("REDIRECT:/logowanie");
    expect(update).not.toHaveBeenCalled();
  });
});
