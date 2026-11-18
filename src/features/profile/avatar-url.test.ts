import { describe, expect, it, vi } from "vitest";

import { getAvatarUrl } from "./avatar-url";

function klient(wynik: unknown) {
  const createSignedUrl = vi.fn().mockImplementation(async () => {
    if (wynik instanceof Error) throw wynik;
    return wynik;
  });
  const from = vi.fn().mockReturnValue({ createSignedUrl });
  return { supabase: { storage: { from } } as never, from, createSignedUrl };
}

describe("getAvatarUrl", () => {
  it("brak ścieżki → null, bez zapytania", async () => {
    const k = klient({ data: { signedUrl: "x" }, error: null });
    expect(await getAvatarUrl(k.supabase, null)).toBeNull();
    expect(k.from).not.toHaveBeenCalled();
  });

  it("podpisuje adres na godzinę w buckecie avatars", async () => {
    const k = klient({ data: { signedUrl: "https://x/y" }, error: null });
    expect(await getAvatarUrl(k.supabase, "u1/avatar.png")).toBe("https://x/y");
    expect(k.from).toHaveBeenCalledWith("avatars");
    expect(k.createSignedUrl).toHaveBeenCalledWith("u1/avatar.png", 3600);
  });

  it("błąd lub wyjątek → null", async () => {
    expect(
      await getAvatarUrl(
        klient({ data: null, error: { message: "x" } }).supabase,
        "u1/avatar.png",
      ),
    ).toBeNull();
    expect(
      await getAvatarUrl(klient(new Error("sieć")).supabase, "u1/avatar.png"),
    ).toBeNull();
  });
});
