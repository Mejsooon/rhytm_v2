import { describe, expect, it } from "vitest";
import {
  blockPatchSchema,
  createBlockSchema,
  isoDateSchema,
  recurrenceSchema,
} from "./schemas";

const poprawny = {
  title: "Nauka",
  categoryId: null,
  date: "2026-11-17",
  startMin: 480,
  durationMin: 60,
  recurrence: null,
  note: "",
  remind: true,
};

describe("recurrenceSchema", () => {
  it("custom bez dni tygodnia jest odrzucony", () => {
    expect(
      recurrenceSchema.safeParse({ freq: "custom", byWeekday: [] }).success,
    ).toBe(false);
    expect(recurrenceSchema.safeParse({ freq: "custom" }).success).toBe(false);
  });
  it("custom z dniami i weekly przechodzą", () => {
    expect(
      recurrenceSchema.safeParse({ freq: "custom", byWeekday: [1, 3] }).success,
    ).toBe(true);
    expect(recurrenceSchema.safeParse({ freq: "weekly" }).success).toBe(true);
  });
  it("dzień tygodnia spoza 1–7 jest odrzucony", () => {
    expect(
      recurrenceSchema.safeParse({ freq: "custom", byWeekday: [0] }).success,
    ).toBe(false);
  });
});

describe("createBlockSchema", () => {
  it("przycina tytuł, pustą notatkę zamienia na null", () => {
    const w = createBlockSchema.parse({ ...poprawny, title: "  Nauka  " });
    expect(w.title).toBe("Nauka");
    expect(w.note).toBeNull();
  });
  it("odrzuca pusty tytuł, za krótki czas i przejście przez północ", () => {
    expect(
      createBlockSchema.safeParse({ ...poprawny, title: "  " }).success,
    ).toBe(false);
    expect(
      createBlockSchema.safeParse({ ...poprawny, durationMin: 10 }).success,
    ).toBe(false);
    expect(
      createBlockSchema.safeParse({
        ...poprawny,
        startMin: 1400,
        durationMin: 60,
      }).success,
    ).toBe(false);
  });
});

describe("blockPatchSchema", () => {
  it("pozwala na częściowy patch, odrzuca zły czas trwania", () => {
    expect(blockPatchSchema.safeParse({ title: "Nowy" }).success).toBe(true);
    expect(blockPatchSchema.safeParse({ durationMin: 5 }).success).toBe(false);
  });
});

describe("isoDateSchema", () => {
  it("odrzuca niemożliwe daty, przyjmuje prawdziwe", () => {
    expect(isoDateSchema.safeParse("2026-13-45").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-30").success).toBe(false);
    expect(isoDateSchema.safeParse("2026-02-28").success).toBe(true);
    expect(isoDateSchema.safeParse("2028-02-29").success).toBe(true);
  });
});
