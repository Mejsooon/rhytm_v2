import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, revalidatePath, remove } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
    storage: { from: () => ({ remove }) },
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { removeAvatar, saveAvatar, saveGoals, saveProfile } from "./actions";

const profil = { display_name: "  Ala  ", timezone: "Europe/Warsaw", weight_kg: 72.5, height_cm: null };
const cele = { sleep_goal_min: 480, weekly_km_goal: 25, currency: "PLN", week_start: "mon" };

describe("ustawienia: akcje", () => {
  const update = vi.fn();
  const eq = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    from.mockReturnValue({ update });
    update.mockReturnValue({ eq });
    eq.mockResolvedValue({ error: null });
  });

  it("saveProfile z wagą 20 → błąd pola, bez update", async () => {
    const wynik = await saveProfile({ ...profil, weight_kg: 20 });
    expect(wynik).toEqual({ ok: false, errors: { weight_kg: "Podaj liczbę 30–250." } });
    expect(update).not.toHaveBeenCalled();
  });

  it("saveProfile z poprawnymi danymi → update z przyciętą nazwą i odświeżeniem layoutu", async () => {
    const wynik = await saveProfile(profil);
    expect(wynik).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenCalledWith({
      display_name: "Ala",
      timezone: "Europe/Warsaw",
      weight_kg: 72.5,
      height_cm: null,
    });
    expect(eq).toHaveBeenCalledWith("user_id", "u1");
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("saveProfile bez sesji → przekierowanie do logowania", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(saveProfile(profil)).rejects.toThrow("REDIRECT:/logowanie");
  });

  it("saveProfile: błąd bazy → ok: false z komunikatem ogólnym", async () => {
    eq.mockResolvedValue({ error: { message: "x" } });
    const wynik = await saveProfile(profil);
    expect(wynik).toEqual({ ok: false, errors: { form: "Nie udało się zapisać. Spróbuj ponownie." } });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("saveGoals z km 0 → błąd pola, bez update", async () => {
    const wynik = await saveGoals({ ...cele, weekly_km_goal: 0 });
    expect(wynik).toEqual({ ok: false, errors: { weekly_km_goal: "Podaj liczbę 1–300." } });
    expect(update).not.toHaveBeenCalled();
  });

  it("saveGoals z poprawnymi danymi → update celów", async () => {
    const wynik = await saveGoals(cele);
    expect(wynik).toEqual({ ok: true });
    expect(update).toHaveBeenCalledWith(cele);
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  describe("zdjęcie profilowe", () => {
    const select = vi.fn();
    const selectEq = vi.fn();
    const maybeSingle = vi.fn();

    beforeEach(() => {
      // from("profiles"): select("avatar_path").eq().maybeSingle() oraz update().eq()
      from.mockReturnValue({ select, update });
      select.mockReturnValue({ eq: selectEq });
      selectEq.mockReturnValue({ maybeSingle });
      maybeSingle.mockResolvedValue({ data: { avatar_path: null }, error: null });
      remove.mockResolvedValue({ error: null });
    });

    it("saveAvatar: obca ścieżka lub traversal → błąd, bez zapisu i usuwania", async () => {
      const zle = ["u2/avatar.png", "u1/../u2/avatar.png", "u1/avatar.gif", "u1/x/avatar.png", "../u1/avatar.png"];
      for (const sciezka of zle) {
        const wynik = await saveAvatar(sciezka);
        expect(wynik).toEqual({ ok: false, error: "Nie udało się wgrać zdjęcia." });
      }
      expect(update).not.toHaveBeenCalled();
      expect(remove).not.toHaveBeenCalled();
    });

    it("saveAvatar: poprawna ścieżka → update avatar_path i odświeżenie layoutu", async () => {
      const wynik = await saveAvatar("u1/avatar.png");
      expect(wynik).toEqual({ ok: true });
      expect(update).toHaveBeenCalledWith({ avatar_path: "u1/avatar.png" });
      expect(eq).toHaveBeenCalledWith("user_id", "u1");
      expect(remove).not.toHaveBeenCalled();
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("saveAvatar: to samo rozszerzenie co poprzednie → nie usuwa pliku", async () => {
      maybeSingle.mockResolvedValue({ data: { avatar_path: "u1/avatar.png" }, error: null });
      await saveAvatar("u1/avatar.png");
      expect(remove).not.toHaveBeenCalled();
    });

    it("saveAvatar: inne rozszerzenie niż poprzednie → usuwa stary plik", async () => {
      maybeSingle.mockResolvedValue({ data: { avatar_path: "u1/avatar.png" }, error: null });
      const wynik = await saveAvatar("u1/avatar.jpg");
      expect(wynik).toEqual({ ok: true });
      expect(remove).toHaveBeenCalledWith(["u1/avatar.png"]);
      expect(update).toHaveBeenCalledWith({ avatar_path: "u1/avatar.jpg" });
    });

    it("saveAvatar: błąd bazy → ok: false, bez odświeżenia", async () => {
      eq.mockResolvedValue({ error: { message: "x" } });
      const wynik = await saveAvatar("u1/avatar.png");
      expect(wynik).toEqual({ ok: false, error: "Nie udało się wgrać zdjęcia." });
      expect(revalidatePath).not.toHaveBeenCalled();
    });

    it("saveAvatar bez sesji → przekierowanie do logowania", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      await expect(saveAvatar("u1/avatar.png")).rejects.toThrow("REDIRECT:/logowanie");
    });

    it("removeAvatar: usuwa plik z bucketu i zeruje avatar_path", async () => {
      maybeSingle.mockResolvedValue({ data: { avatar_path: "u1/avatar.webp" }, error: null });
      const wynik = await removeAvatar();
      expect(wynik).toEqual({ ok: true });
      expect(remove).toHaveBeenCalledWith(["u1/avatar.webp"]);
      expect(update).toHaveBeenCalledWith({ avatar_path: null });
      expect(eq).toHaveBeenCalledWith("user_id", "u1");
      expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
    });

    it("removeAvatar: błąd usuwania pliku → ok: false, avatar_path bez zmian", async () => {
      maybeSingle.mockResolvedValue({ data: { avatar_path: "u1/avatar.webp" }, error: null });
      remove.mockResolvedValue({ error: { message: "x" } });
      const wynik = await removeAvatar();
      expect(wynik).toEqual({ ok: false, error: "Nie udało się usunąć zdjęcia." });
      expect(update).not.toHaveBeenCalled();
    });

    it("removeAvatar bez sesji → przekierowanie do logowania", async () => {
      getUser.mockResolvedValue({ data: { user: null } });
      await expect(removeAvatar()).rejects.toThrow("REDIRECT:/logowanie");
    });
  });
});
