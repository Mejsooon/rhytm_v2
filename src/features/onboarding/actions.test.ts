import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { fakeTable } from "@/test-utils/fake-supabase";

const { getUser, from, rpc, createBlock } = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  createBlock: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));
vi.mock("@/features/calendar/actions", () => ({ createBlock }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

import { saveOnboardingStep } from "./actions";

const BLAD = "Nie udało się zapisać. Spróbuj ponownie.";
let tables: Record<string, ReturnType<typeof fakeTable>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-28T10:00:00Z"));
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  createBlock.mockResolvedValue({ ok: true });
  rpc.mockResolvedValue({ error: null });
  tables = {
    profiles: fakeTable({ single: { roles: ["studia"], timezone: "Europe/Warsaw" } }),
    categories: fakeTable({ data: [{ id: "k1", name: "Studia", position: 0 }] }),
    blocks: fakeTable({ data: [] }),
    notification_settings: fakeTable(),
  };
  from.mockImplementation((nazwa: string) => tables[nazwa]);
});
afterEach(() => vi.useRealTimers());

const krok2 = { uses: ["run", "subs"], weekly_km_goal: 40, weekly_workouts_goal: 3, sleep_goal_min: 480 };
const blok = { title: "Zajęcia", category: "Studia", start_min: 480, end_min: 570 };

describe("saveOnboardingStep", () => {
  it("zły numer kroku albo dane → bez zapisu", async () => {
    expect(await saveOnboardingStep(5 as 1, {})).toEqual({ ok: false, message: BLAD });
    expect((await saveOnboardingStep(2, { ...krok2, uses: ["admin"] })).ok).toBe(false);
    expect((await saveOnboardingStep(3, { blocks: [{ ...blok, end_min: 480 }] })).ok).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });

  it("krok 2: wybory, strony i tylko cele wybranych; postęp na 3", async () => {
    expect(await saveOnboardingStep(2, krok2)).toEqual({ ok: true });
    expect(tables.profiles.update).toHaveBeenNthCalledWith(1, {
      roles: ["run", "subs"],
      pending_pages: ["Subscriptions"],
      km_goal_on: true,
      workouts_goal_on: false,
      weekly_km_goal: 40,
    });
    expect(tables.profiles.update).toHaveBeenNthCalledWith(2, { onboarding_step: 3 });
  });

  it("krok 2 bez biegania i siłowni nie rusza celów treningowych", async () => {
    await saveOnboardingStep(2, { ...krok2, uses: ["books"] });
    expect(tables.profiles.update).toHaveBeenNthCalledWith(1, { roles: ["books"], pending_pages: ["Books"] });
  });

  it("krok 3: blok na dziś w kategorii z wyborów", async () => {
    expect(await saveOnboardingStep(3, { blocks: [blok] })).toEqual({ ok: true });
    expect(createBlock).toHaveBeenCalledWith({
      title: "Zajęcia",
      categoryId: "k1",
      date: "2026-11-28",
      startMin: 480,
      durationMin: 90,
      recurrence: null,
      note: "",
      remind: true,
    });
  });

  it("krok 3: blok już zapisany (ponowienie) nie powstaje drugi raz; błąd zapisu zatrzymuje krok", async () => {
    tables.blocks = fakeTable({ data: [{ title: "Zajęcia", start_local: "2026-11-28T08:00:00" }] });
    await saveOnboardingStep(3, { blocks: [blok] });
    expect(createBlock).not.toHaveBeenCalled();

    createBlock.mockResolvedValue({ ok: false, message: "x" });
    expect(await saveOnboardingStep(3, { blocks: [{ ...blok, title: "Inny" }] })).toEqual({ ok: false, message: "x" });
  });

  it("krok 4: przypomnienia (5 min), źródło, koniec i przejście na Dziś", async () => {
    await expect(
      saveOnboardingStep(4, { referral_source: "uni", push_enabled: false, before: true, renew: false, habits: true }),
    ).rejects.toThrow("REDIRECT:/dzis");
    expect(tables.notification_settings.upsert).toHaveBeenCalledWith(
      { user_id: "u1", push_enabled: false, before_block_min: 5, renewals_enabled: false, habits_enabled: true },
      { onConflict: "user_id" },
    );
    expect(tables.profiles.update).toHaveBeenCalledWith({ referral_source: "uni", referral_other: null });
    expect(rpc).toHaveBeenCalledWith("complete_onboarding", {
      p_categories: [{ name: "Studia", color: "#0070f3", is_system: false }],
    });
  });
});
