import { describe, expect, it } from "vitest";

import { activityKcal, activityKinds } from "./activities";

describe("activityKinds", () => {
  it("nadpisuje kolor podstawowego i dokleja własne", () => {
    const rodzaje = activityKinds([
      { name: "tenis", color: "#dc2626", has_distance: false },
      { name: "Curling", color: "#0891b2", has_distance: true },
    ]);
    expect(rodzaje).toHaveLength(17);
    expect(rodzaje[0]).toEqual({ name: "Tenis", met: 7.3, hasDistance: false, color: "#dc2626" });
    expect(rodzaje.at(-1)).toEqual({ name: "Curling", met: 5, hasDistance: true, color: "#0891b2" });
  });
});

describe("activityKcal", () => {
  it("MET × waga × godziny, bez wagi lub czasu null", () => {
    expect(activityKcal(7.3, 4500, 72)).toBe(657);
    expect(activityKcal(7.3, 4500, null)).toBeNull();
    expect(activityKcal(7.3, null, 72)).toBeNull();
  });
});
