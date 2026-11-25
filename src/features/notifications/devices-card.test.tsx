import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { setDeviceEnabled } = vi.hoisted(() => ({ setDeviceEnabled: vi.fn() }));
vi.mock("./push-actions", () => ({ setDeviceEnabled }));

import { DevicesCard } from "./devices-card";

const KOMPUTER = {
  id: "d1",
  endpoint: "https://fcm.googleapis.com/fcm/send/komputer",
  label: "Chrome · Linux",
  mobile: false,
  enabled: true,
  lastSeenAt: "2026-11-24T11:29:00Z",
};
const TELEFON = {
  id: "d2",
  endpoint: "https://web.push.apple.com/telefon",
  label: "Safari · iPhone",
  mobile: true,
  enabled: true,
  lastSeenAt: "2026-11-23T20:14:00Z",
};

function pokaz(over: Partial<Parameters<typeof DevicesCard>[0]> = {}) {
  return render(
    <DevicesCard
      devices={[KOMPUTER, TELEFON]}
      currentEndpoint={KOMPUTER.endpoint}
      loadError={false}
      timeZone="Europe/Warsaw"
      {...over}
    />,
  );
}

describe("DevicesCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ toFake: ["Date"] });
    // 24.11.2026 12:30 w Warszawie
    vi.setSystemTime(new Date("2026-11-24T11:30:00Z"));
    setDeviceEnabled.mockResolvedValue({ ok: true });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("plakietka „TO” tylko przy bieżącym endpoincie; podpisy ostatniej aktywności", () => {
    pokaz();
    expect(screen.getAllByText("TO")).toHaveLength(1);
    expect(screen.getByText("Chrome · Linux").parentElement).toHaveTextContent("TO");
    expect(screen.getByText("ostatnio: teraz")).toBeInTheDocument();
    expect(screen.getByText("ostatnio: wczoraj 21:14")).toBeInTheDocument();
  });

  it("bez bieżącej subskrypcji → bez „TO”; dziś i starsza data", () => {
    pokaz({
      currentEndpoint: null,
      devices: [
        { ...KOMPUTER, lastSeenAt: "2026-11-24T07:02:00Z" },
        { ...TELEFON, lastSeenAt: "2026-11-12T07:02:00Z" },
      ],
    });
    expect(screen.queryByText("TO")).toBeNull();
    expect(screen.getByText("ostatnio: dziś 08:02")).toBeInTheDocument();
    expect(screen.getByText("ostatnio: 12.11 08:02")).toBeInTheDocument();
  });

  it("„Wyłącz” → akcja, podpis „powiadomienia wyłączone” i „Włącz”", async () => {
    pokaz();
    fireEvent.click(screen.getByRole("button", { name: "Wyłącz: Safari · iPhone" }));
    expect(setDeviceEnabled).toHaveBeenCalledWith("d2", false);
    expect(screen.getByText("powiadomienia wyłączone")).toBeInTheDocument();
    const wlacz = screen.getByRole("button", { name: "Włącz: Safari · iPhone" });
    expect(wlacz).toHaveTextContent("Włącz");
    fireEvent.click(wlacz);
    await waitFor(() => expect(setDeviceEnabled).toHaveBeenLastCalledWith("d2", true));
  });

  it("wyłączone urządzenie z serwera → „powiadomienia wyłączone” i „Włącz”", () => {
    pokaz({ devices: [{ ...TELEFON, enabled: false }] });
    expect(screen.getByText("powiadomienia wyłączone")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Włącz: Safari · iPhone" })).toBeInTheDocument();
  });

  it("błąd zapisu cofa przełączenie i pokazuje komunikat", async () => {
    setDeviceEnabled.mockResolvedValue({
      ok: false,
      message: "To urządzenie zostało już usunięte.",
    });
    pokaz();
    fireEvent.click(screen.getByRole("button", { name: "Wyłącz: Safari · iPhone" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "To urządzenie zostało już usunięte.",
    );
    expect(screen.getByRole("button", { name: "Wyłącz: Safari · iPhone" })).toBeInTheDocument();
  });

  it("pusta lista → tekst", () => {
    pokaz({ devices: [] });
    expect(
      screen.getByText("Brak urządzeń. Włącz push na tym urządzeniu powyżej."),
    ).toBeInTheDocument();
  });

  it("błąd odczytu → komunikat", () => {
    pokaz({ devices: [], loadError: true });
    expect(screen.getByText("Nie udało się wczytać urządzeń.")).toBeInTheDocument();
  });

  it("telefon: wiersze urządzeń jak m-row, karta bez własnego paddingu", () => {
    pokaz();
    const wiersz = screen.getByText("Chrome · Linux").closest("div.flex-wrap") as HTMLElement;
    expect(wiersz.className).toContain("max-[799px]:min-h-[60px]");
    expect(wiersz.className).toContain("max-[799px]:flex-nowrap");
    expect(wiersz.parentElement?.className).toContain("max-[799px]:p-0");
  });
});
