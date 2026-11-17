import { beforeEach, describe, expect, it, vi } from "vitest";

const upload = vi.fn();
// Osobna flaga zamiast rzucania z vi.fn (vitest zgłasza taki wyjątek jako błąd testu mimo catch)
const stan = { rzuc: false };
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: (...a: unknown[]) => {
          if (stan.rzuc) throw new Error("net");
          return upload(...a);
        },
      }),
    },
  }),
}));

import { uploadAvatar, validateAvatarFile } from "./avatar-upload";

function plik(rozmiar: number, typ: string, nazwa = "a") {
  const f = new File(["x"], nazwa, { type: typ });
  Object.defineProperty(f, "size", { value: rozmiar });
  return f;
}

const MB = 1024 * 1024;

describe("validateAvatarFile", () => {
  it("2 MB dokładnie jest OK", () => {
    expect(validateAvatarFile(plik(2 * MB, "image/png"))).toBeNull();
  });
  it("2 MB + 1 B to błąd rozmiaru", () => {
    expect(validateAvatarFile(plik(2 * MB + 1, "image/png"))).toBe(
      "Plik jest za duży (maks. 2 MB).",
    );
  });
  it("image/webp jest OK", () => {
    expect(validateAvatarFile(plik(1000, "image/webp"))).toBeNull();
  });
  it("gif to błąd formatu", () => {
    expect(validateAvatarFile(plik(1000, "image/gif"))).toBe(
      "Wybierz zdjęcie PNG, JPG albo WebP.",
    );
  });
});

describe("uploadAvatar", () => {
  beforeEach(() => {
    upload.mockReset();
    stan.rzuc = false;
  });

  it.each([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"],
  ])("%s -> %s, upsert", async (typ, ext) => {
    upload.mockResolvedValue({ error: null });
    const f = plik(10, typ);
    const wynik = await uploadAvatar(f, "u1");
    expect(wynik).toEqual({ path: `u1/avatar.${ext}` });
    expect(upload).toHaveBeenCalledWith(`u1/avatar.${ext}`, f, {
      upsert: true,
      contentType: typ,
    });
  });

  it("błąd storage -> komunikat", async () => {
    upload.mockResolvedValue({ error: { message: "boom" } });
    expect(await uploadAvatar(plik(10, "image/png"), "u1")).toEqual({
      error: "Nie udało się wgrać zdjęcia.",
    });
  });

  it("wyjątek -> komunikat", async () => {
    stan.rzuc = true;
    expect(await uploadAvatar(plik(10, "image/png"), "u1")).toEqual({
      error: "Nie udało się wgrać zdjęcia.",
    });
  });
});
