import { describe, expect, it } from "vitest";

import {
  blockValid,
  canContinue,
  categoriesForUses,
  pagesForUses,
  stepPayload,
  suggestions,
  toMinutes,
  type DraftBlock,
  type OnboardingDraft,
} from "./model";

export const draft: OnboardingDraft = {
  name: "Mejson",
  avatarPath: null,
  timezone: "Europe/Warsaw",
  weekStart: "mon",
  clock: "24",
  uses: ["studia", "run"],
  weeklyWorkouts: 3,
  weeklyKm: 25,
  sleepGoalMin: 480,
  blocks: [],
  source: null,
  notify: { perm: false, before: true, renew: true, habits: false },
};

const blok: DraftBlock = { title: "Zajęcia", start: "08:00", end: "09:30", category: "Studia" };

describe("wybory", () => {
  it("kategorie z wyborów; nic z planu i ruchu → Dom", () => {
    expect(categoriesForUses(["studia", "firma", "oth"]).map((k) => k.name)).toEqual(["Studia", "Projekty", "Sport"]);
    expect(categoriesForUses(["books"]).map((k) => k.name)).toEqual(["Dom"]);
  });

  it("strony: subskrypcje, projekty (także od klientów), książki", () => {
    expect(pagesForUses(["subs", "firma", "books"])).toEqual(["Subscriptions", "Projects", "Books"]);
    expect(pagesForUses(["run"])).toEqual([]);
  });

  it("podpowiedzi tylko z wyborów i bez już dodanych", () => {
    expect(suggestions(["studia", "run"], [blok]).map((b) => b.title)).toEqual(["Nauka do kolokwium", "Bieg 8 km"]);
  });
});

describe("godziny i „Dalej”", () => {
  it("czyta HH:MM i odrzuca złe zapisy", () => {
    expect(toMinutes("8:05")).toBe(485);
    for (const zle of ["24:00", "8", "08:60", ""]) expect(toMinutes(zle)).toBeNull();
    expect(blockValid({ ...blok, end: "08:00" })).toBe(false);
  });

  it("blokuje: puste imię, zły wybrany cel, zła godzina; niewybrany cel nie przeszkadza", () => {
    expect(canContinue(1, { ...draft, name: " " })).toBe(false);
    expect(canContinue(2, { ...draft, weeklyKm: Number.NaN })).toBe(false);
    expect(canContinue(2, { ...draft, uses: [], weeklyKm: Number.NaN })).toBe(true);
    expect(canContinue(3, { ...draft, blocks: [{ ...blok, end: "07" }] })).toBe(false);
    expect(canContinue(4, draft)).toBe(true);
  });

  it("krok 3 wysyła tylko niezapisane bloki, w minutach", () => {
    expect(stepPayload(3, { ...draft, blocks: [{ ...blok, saved: true }, blok] })).toEqual({
      blocks: [{ title: "Zajęcia", category: "Studia", start_min: 480, end_min: 570 }],
    });
  });
});
