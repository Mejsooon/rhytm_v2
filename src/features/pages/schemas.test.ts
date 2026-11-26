import { describe, expect, it } from "vitest";

import { importOptionsSchema, tableSettingsPatchSchema } from "./schemas";

const widok = (hidden: string[]) => ({
  id: "w1",
  name: "Widok",
  filters: [],
  sort: [],
  group_by: null,
  layout: "table" as const,
  hidden_field_ids: hidden,
});

describe("tableSettingsPatchSchema: limity", () => {
  it("hidden_field_ids: id do 64 znaków, do 200 pozycji (także w widokach)", () => {
    expect(tableSettingsPatchSchema.safeParse({ hidden_field_ids: ["a".repeat(64)] }).success).toBe(true);
    expect(tableSettingsPatchSchema.safeParse({ hidden_field_ids: ["a".repeat(65)] }).success).toBe(false);
    expect(tableSettingsPatchSchema.safeParse({ hidden_field_ids: Array(201).fill("a") }).success).toBe(false);
    expect(tableSettingsPatchSchema.safeParse({ views: [widok(["a".repeat(65)])] }).success).toBe(false);
    expect(tableSettingsPatchSchema.safeParse({ views: [widok(Array(201).fill("a"))] }).success).toBe(false);
    expect(tableSettingsPatchSchema.safeParse({ views: [widok(["a"])] }).success).toBe(true);
  });

  it("collapsed_groups: do 50 kluczy i 200 wpisów na klucz", () => {
    const klucze = (n: number) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`k${i}`, ["x"]]));
    expect(tableSettingsPatchSchema.safeParse({ collapsed_groups: klucze(50) }).success).toBe(true);
    expect(tableSettingsPatchSchema.safeParse({ collapsed_groups: klucze(51) }).success).toBe(false);
    expect(tableSettingsPatchSchema.safeParse({ collapsed_groups: { all: Array(200).fill("x") } }).success).toBe(true);
    expect(tableSettingsPatchSchema.safeParse({ collapsed_groups: { all: Array(201).fill("x") } }).success).toBe(false);
  });
});

describe("importOptionsSchema", () => {
  it("odrzuca opcję z pustą etykietą", () => {
    expect(importOptionsSchema.safeParse({ "new:0": [{ id: "o", label: "", color: "#15803d" }] }).success).toBe(false);
    expect(importOptionsSchema.safeParse({ "new:0": [{ id: "o", label: "A", color: "#15803d" }] }).success).toBe(true);
  });
});
