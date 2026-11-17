import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, from, rpc } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { completeOnboarding, saveOnboardingStep } from "./actions";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";

const krok1 = {
  display_name: "Ala",
  timezone: "Europe/Warsaw",
  week_start: "mon",
  clock: "24",
  avatar_path: null,
};

describe("saveOnboardingStep", () => {
  // update(...).eq(...) → dane; progress: update(...).eq(...).lt(...)
  const update = vi.fn();
  const eq = vi.fn();
  const lt = vi.fn();
  const upsert = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    from.mockReturnValue({ update, upsert });
    update.mockReturnValue({ eq });
    // eq zwraca obiekt, który jest jednocześnie obietnicą (zapis pól) i ma .lt (postęp)
    eq.mockImplementation(() => Object.assign(Promise.resolve({ error: null }), { lt }));
    lt.mockResolvedValue({ error: null });
    upsert.mockResolvedValue({ error: null });
  });

  it("krok 1 z pustą nazwą → ok: false, bez zapisu", async () => {
    const wynik = await saveOnboardingStep(1, { ...krok1, display_name: "" });
    expect(wynik.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it("krok 2 zapisuje przycięte pola dla zalogowanego i podnosi postęp", async () => {
    const wynik = await saveOnboardingStep(2, { roles: ["student"], study_field: " Cyber " });
    expect(wynik).toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("profiles");
    expect(update).toHaveBeenNthCalledWith(1, { roles: ["student"], study_field: "Cyber" });
    expect(eq).toHaveBeenNthCalledWith(1, "user_id", "u1");
    // postęp: onboarding_step = 3, tylko gdy obecny < 3 (bez cofania)
    expect(update).toHaveBeenNthCalledWith(2, { onboarding_step: 3 });
    expect(lt).toHaveBeenCalledWith("onboarding_step", 3);
  });

  it("krok 1 z avatar_path z cudzego folderu → ok: false", async () => {
    const wynik = await saveOnboardingStep(1, { ...krok1, avatar_path: "u2/avatar.png" });
    expect(wynik.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });

  it.each(["u1/../u2/a.png", "u1/x/avatar.png", "u1/avatar.gif", "u1/avatar.png/x"])(
    "krok 1 z niedozwolonym avatar_path %s → ok: false",
    async (sciezka) => {
      const wynik = await saveOnboardingStep(1, { ...krok1, avatar_path: sciezka });
      expect(wynik.ok).toBe(false);
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("krok 1 z własnym avatar_path → zapis", async () => {
    const wynik = await saveOnboardingStep(1, { ...krok1, avatar_path: "u1/avatar.png" });
    expect(wynik).toEqual({ ok: true });
    expect(update).toHaveBeenNthCalledWith(1, {
      display_name: "Ala",
      timezone: "Europe/Warsaw",
      week_start: "mon",
      clock: "24",
      avatar_path: "u1/avatar.png",
    });
  });

  it("krok 6 upsertuje notification_settings (before → 10, wyłączone → null)", async () => {
    const ustawienia = { push_enabled: true, before: true, renew: false, weekly: true, habits: false };
    await expect(saveOnboardingStep(6, ustawienia)).resolves.toEqual({ ok: true });
    expect(from).toHaveBeenCalledWith("notification_settings");
    expect(upsert).toHaveBeenLastCalledWith(
      {
        user_id: "u1",
        push_enabled: true,
        before_block_min: 10,
        renewals_enabled: false,
        weekly_summary: true,
        habits_enabled: false,
      },
      { onConflict: "user_id" },
    );
    expect(lt).toHaveBeenCalledWith("onboarding_step", 7);

    await saveOnboardingStep(6, { ...ustawienia, before: false });
    expect(upsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ before_block_min: null }),
      { onConflict: "user_id" },
    );
  });

  it("błąd zapisu → komunikat", async () => {
    eq.mockImplementationOnce(() => Object.assign(Promise.resolve({ error: { message: "boom" } }), { lt }));
    const wynik = await saveOnboardingStep(2, { roles: [], study_field: "" });
    expect(wynik).toEqual({ ok: false, message: BLAD });
  });

  it("błąd zapisu postępu → komunikat", async () => {
    lt.mockResolvedValue({ error: { message: "boom" } });
    const wynik = await saveOnboardingStep(2, { roles: [], study_field: "" });
    expect(wynik).toEqual({ ok: false, message: BLAD });
  });

  it("bez sesji → /logowanie, bez zapisu", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(saveOnboardingStep(2, { roles: [], study_field: "" })).rejects.toThrow("REDIRECT:/logowanie");
    expect(update).not.toHaveBeenCalled();
  });
});

describe("completeOnboarding", () => {
  const maybeSingle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle }) }) });
    maybeSingle.mockResolvedValue({ data: { roles: ["sport"] }, error: null });
    rpc.mockResolvedValue({ error: null });
  });

  it("woła rpc z kategoriami z ról i przechodzi na /dzis", async () => {
    await expect(completeOnboarding()).rejects.toThrow("REDIRECT:/dzis");
    expect(rpc).toHaveBeenCalledWith("complete_onboarding", {
      p_categories: [{ name: "Sport", color: "#c2410c", is_system: true }],
    });
  });

  it("błąd RPC → komunikat, bez przekierowania", async () => {
    rpc.mockResolvedValue({ error: { message: "boom" } });
    await expect(completeOnboarding()).resolves.toEqual({ ok: false, message: BLAD });
  });

  it("błąd odczytu ról → komunikat, bez RPC", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(completeOnboarding()).resolves.toEqual({ ok: false, message: BLAD });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("bez sesji → /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(completeOnboarding()).rejects.toThrow("REDIRECT:/logowanie");
  });
});
