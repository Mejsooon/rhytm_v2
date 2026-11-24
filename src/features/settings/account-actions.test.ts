import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, updateUser, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser, updateUser } }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { requestEmailChange } from "./account-actions";

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
