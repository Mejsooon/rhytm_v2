import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { planGymSession } = vi.hoisted(() => ({ planGymSession: vi.fn() }));
vi.mock("./actions", () => ({ planGymSession }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { GymPlanDialog } from "./gym-plan-dialog";
import type { SportItem } from "./model";
import { daneSportu, SZABLON_PUSH } from "./sport-test-data";

const onClose = vi.fn();
const onStartNow = vi.fn();

function pokaz(props: Partial<Parameters<typeof GymPlanDialog>[0]> = {}) {
  render(
    <GymPlanDialog
      templates={daneSportu().templates}
      today="2026-11-17"
      clock="24"
      weekStart="mon"
      date="2026-11-17"
      start="17:30"
      onClose={onClose}
      onStartNow={onStartNow}
      onDelete={vi.fn()}
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  planGymSession.mockResolvedValue({ ok: true });
});

describe("GymPlanDialog", () => {
  it("jutro, 90 min → zapis z końcem; „Rozpocznij teraz” znika poza dzisiejszym dniem", async () => {
    const user = userEvent.setup();
    pokaz();
    await user.click(screen.getByRole("radio", { name: "Jutro" }));
    expect(screen.queryByRole("button", { name: "Rozpocznij teraz" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "90 min" }));
    await user.click(screen.getByRole("button", { name: "Zaplanuj" }));
    expect(planGymSession).toHaveBeenCalledWith({
      sessionId: undefined,
      templateId: undefined,
      originalDate: undefined,
      date: "2026-11-18",
      start: "17:30",
      end: "19:00",
      showInCalendar: true,
    });
    expect(onClose).toHaveBeenCalled();
  });

  it("zmiana terminu wystąpienia szablonu zapamiętuje jego dzień", async () => {
    const item = {
      key: `t:${SZABLON_PUSH}:2026-11-19`,
      kind: "gym",
      sessionId: null,
      templateId: SZABLON_PUSH,
      date: "2026-11-19",
      startMin: 17 * 60,
      durationMin: 60,
      title: "Push",
      planned: true,
      showInCalendar: true,
    } as SportItem;
    const user = userEvent.setup();
    pokaz({ item });
    expect(screen.queryByRole("radiogroup", { name: "Trening" })).toBeNull();
    await user.click(screen.getByRole("radio", { name: "Jutro" }));
    await user.click(screen.getByRole("button", { name: "Zapisz zmiany" }));
    expect(planGymSession).toHaveBeenCalledWith(
      expect.objectContaining({ templateId: SZABLON_PUSH, originalDate: "2026-11-19", date: "2026-11-18" }),
    );
  });
});
