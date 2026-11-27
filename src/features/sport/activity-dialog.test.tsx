import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ActivityDialog, parseActivityTime } from "./activity-dialog";

const { saveActivity } = vi.hoisted(() => ({ saveActivity: vi.fn() }));
vi.mock("./activity-actions", () => ({ saveActivity }));

const profile = {
  timezone: "Europe/Warsaw",
  weekStart: "mon" as const,
  clock: "24" as const,
  weightKg: 72,
  workoutsGoalOn: true,
  weeklyWorkoutsGoal: 3,
  kmGoalOn: true,
  weeklyKmGoal: 25,
};

describe("parseActivityTime", () => {
  it("g:mm albo minuty", () => {
    expect(parseActivityTime("1:15")).toBe(4500);
    expect(parseActivityTime("45")).toBe(2700);
    expect(parseActivityTime("1:75")).toBeNull();
    expect(parseActivityTime("abc")).toBeNull();
  });
});

describe("ActivityDialog", () => {
  it("liczy kcal na żywo i zapisuje wybraną aktywność", async () => {
    saveActivity.mockResolvedValue({ ok: true });
    const onClose = vi.fn();
    render(<ActivityDialog item={null} date="2026-11-17" start="16:00" profile={profile} kinds={[]} onClose={onClose} />);
    fireEvent.change(screen.getByLabelText("Czas trwania"), { target: { value: "1:15" } });
    expect(screen.getByTestId("kcal")).toHaveTextContent("≈ 657");
    fireEvent.click(screen.getByRole("button", { name: "Zapisz: Tenis" }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(saveActivity).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "Tenis", done: true, durationS: 4500, distanceKm: null, color: "#65a30d" }),
    );
  });
});
