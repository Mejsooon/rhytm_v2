import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, revalidatePath } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from }),
}));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { saveGoals, saveProfile } from "./actions";

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
});
