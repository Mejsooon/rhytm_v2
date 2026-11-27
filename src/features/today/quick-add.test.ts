import { describe, expect, it } from "vitest";
import { activityKinds } from "@/features/sport/activities";
import { parseQuickAdd } from "./quick-add";

// Wtorek 17.11.2026, jak na makiecie
const parse = (t: string) =>
  parseQuickAdd(t, "2026-11-17", [{ id: "s1", name: "Push" }], activityKinds([]));

describe("parseQuickAdd", () => {
  it("przykłady z makiety", () => {
    expect(parse("bieg 10 km jutro 18:00")).toMatchObject({ type: "run", date: "2026-11-18", startMin: 1080, distanceKm: 10 });
    expect(parse("siłownia push pt 17:00")).toMatchObject({ type: "gym", date: "2026-11-20", startMin: 1020, template: { id: "s1" } });
    expect(parse("tenis sob 10–12")).toMatchObject({ type: "other", date: "2026-11-21", startMin: 600, endMin: 720, activity: { name: "Tenis" } });
    expect(parse("blok nauka matma jutro 8–10")).toMatchObject({ type: "block", title: "Nauka matma", startMin: 480, endMin: 600 });
    expect(parse("sen 23:40–7:10")).toMatchObject({ type: "sleep", startMin: 1420, endMin: 430 });
    expect(parse("nawyk woda 2 l")).toMatchObject({ type: "habit", title: "Woda 2 l" });
  });

  it("dzisiejszy skrót dnia to za tydzień; nieznany tekst to blok; zła godzina jest pomijana", () => {
    expect(parse("wt").date).toBe("2026-11-24");
    expect(parse("zakupy")).toMatchObject({ type: "block", title: "Zakupy", date: "2026-11-17", startMin: null });
    expect(parse("zakupy 25:00").startMin).toBeNull();
  });
});
