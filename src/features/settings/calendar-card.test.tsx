import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DOMYSLNE_USTAWIENIA } from "@/features/calendar/settings";
import { saveCalendarSettings } from "@/features/calendar/settings-actions";
import { CalendarSettingsCard } from "./calendar-card";

vi.mock("@/features/calendar/settings-actions", () => ({ saveCalendarSettings: vi.fn() }));
const zapis = vi.mocked(saveCalendarSettings);

describe("CalendarSettingsCard", () => {
  beforeEach(() => zapis.mockReset());

  it("zapisuje zmianę od razu", async () => {
    zapis.mockResolvedValue({ ok: true });
    render(<CalendarSettingsCard settings={DOMYSLNE_USTAWIENIA} />);
    fireEvent.click(screen.getByRole("radio", { name: "Miesiąc" }));
    expect(zapis).toHaveBeenCalledWith({ view: "miesiac" });
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Zapisano"));
  });

  it("po błędzie wraca poprzednia wartość", async () => {
    zapis.mockResolvedValue({ ok: false, message: "Nie udało się." });
    render(<CalendarSettingsCard settings={DOMYSLNE_USTAWIENIA} />);
    fireEvent.click(screen.getByRole("switch", { name: "Numery tygodni" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Nie udało się."));
    expect(screen.getByRole("switch", { name: "Numery tygodni" })).toHaveAttribute("aria-checked", "true");
  });
});
