import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { PushStan } from "./use-push-device";

const { hook, saveNotificationSettings, sendTestPush, setHabitReminder, setDeviceEnabled } =
  vi.hoisted(() => ({
    hook: {
      stan: "wlaczony" as PushStan,
      endpoint: "https://fcm.googleapis.com/fcm/send/ten" as string | null,
      blad: null as string | null,
      zajety: false,
      wlacz: vi.fn(async () => undefined),
      wylacz: vi.fn(async () => undefined),
    },
    saveNotificationSettings: vi.fn(),
    sendTestPush: vi.fn(),
    setHabitReminder: vi.fn(),
    setDeviceEnabled: vi.fn(),
  }));
vi.mock("./use-push-device", () => ({ usePushDevice: () => hook }));
vi.mock("./actions", () => ({ saveNotificationSettings, sendTestPush, setHabitReminder }));
vi.mock("./push-actions", () => ({ setDeviceEnabled }));

import { NotificationsTab, type NotificationSettings } from "./notifications-card";

const USTAWIENIA: NotificationSettings = {
  habits: true,
  block: true,
  renewals: false,
  quiet: true,
  quietFrom: "23:00",
  quietTo: "07:00",
};
const URZADZENIE = {
  id: "d1",
  endpoint: "https://fcm.googleapis.com/fcm/send/ten",
  label: "Chrome · Linux",
  mobile: false,
  enabled: true,
  lastSeenAt: "2026-11-24T11:00:00Z",
  createdAt: "2026-11-12T09:00:00Z",
};

function pokaz(over: Partial<Parameters<typeof NotificationsTab>[0]> = {}) {
  return render(
    <NotificationsTab
      settings={USTAWIENIA}
      devices={[URZADZENIE]}
      devicesLoadError={false}
      habits={[]}
      timeZone="Europe/Warsaw"
      {...over}
    />,
  );
}
function karta() {
  return within(screen.getByTestId("karta-powiadomienia"));
}
function przelacznik(nazwa: string) {
  return karta().getByRole("switch", { name: nazwa });
}

describe("NotificationsTab — karta główna", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hook.stan = "wlaczony";
    hook.endpoint = URZADZENIE.endpoint;
    hook.blad = null;
    hook.zajety = false;
    saveNotificationSettings.mockResolvedValue({ ok: true });
    sendTestPush.mockResolvedValue({ ok: true, sent: 2 });
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["wlaczony", "Chrome · Linux · włączone 12.11.2026"],
    ["wylaczony", "Wyłączone — nie dostaniesz żadnych powiadomień na tym urządzeniu"],
    ["nieskonfigurowany", "Push nie jest jeszcze skonfigurowany"],
    ["nieobslugiwany", "Ta przeglądarka nie obsługuje powiadomień push"],
    ["ios-instalacja", "Na iPhonie push działa po dodaniu rhytm do ekranu głównego"],
    ["zablokowany", "Powiadomienia są zablokowane w ustawieniach przeglądarki"],
  ] as const)("stan %s → podpis „%s”", (stan, podpis) => {
    hook.stan = stan;
    pokaz();
    expect(karta().getByText(podpis)).toBeInTheDocument();
    const sw = przelacznik("Push na tym urządzeniu");
    expect(sw).toHaveAttribute("aria-checked", String(stan === "wlaczony"));
    if (stan === "wlaczony" || stan === "wylaczony")
      expect(sw).not.toHaveAttribute("aria-disabled");
    else expect(sw).toHaveAttribute("aria-disabled", "true");
  });

  it("przełącznik push woła wlacz / wylacz; błąd hooka pod podpisem", () => {
    hook.blad = "Nie udało się włączyć powiadomień.";
    pokaz();
    expect(karta().getByText("Nie udało się włączyć powiadomień.")).toBeInTheDocument();
    fireEvent.click(przelacznik("Push na tym urządzeniu"));
    expect(hook.wylacz).toHaveBeenCalled();
  });

  it("w trakcie włączania przełącznik zablokowany", () => {
    hook.stan = "wylaczony";
    hook.zajety = true;
    pokaz();
    const sw = przelacznik("Push na tym urządzeniu");
    expect(sw).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(sw);
    expect(hook.wlacz).not.toHaveBeenCalled();
  });

  it("push wyłączony → rodzaje i tak działają (sterują listą w aplikacji)", async () => {
    hook.stan = "wylaczony";
    pokaz();
    const sw = przelacznik("Odnowienia subskrypcji");
    expect(sw).not.toHaveAttribute("aria-disabled");
    fireEvent.click(sw);
    await waitFor(() => expect(saveNotificationSettings).toHaveBeenCalled());
  });

  it("push nieskonfigurowany (brak VAPID) → rodzaje działają i zapisują się", async () => {
    hook.stan = "nieskonfigurowany";
    pokaz();
    const sw = przelacznik("Odnowienia subskrypcji");
    expect(sw).not.toHaveAttribute("aria-disabled");
    fireEvent.click(sw);
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenCalledWith({ renewals_enabled: true }),
    );
  });

  it("przełączenie rodzaju → akcja z właściwym polem (before_block_min 5 ↔ null)", async () => {
    pokaz();
    fireEvent.click(przelacznik("Start bloku w kalendarzu"));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenCalledWith({ before_block_min: null }),
    );
    fireEvent.click(przelacznik("Start bloku w kalendarzu"));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenLastCalledWith({ before_block_min: 5 }),
    );
    fireEvent.click(przelacznik("Przypomnienia o nawykach"));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenLastCalledWith({ habits_enabled: false }),
    );
    fireEvent.click(przelacznik("Odnowienia subskrypcji"));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenLastCalledWith({ renewals_enabled: true }),
    );
  });

  it("błąd zapisu cofa przełącznik i pokazuje komunikat", async () => {
    saveNotificationSettings.mockResolvedValue({
      ok: false,
      message: "Nie udało się zapisać. Spróbuj ponownie.",
    });
    pokaz();
    const sw = przelacznik("Odnowienia subskrypcji");
    fireEvent.click(sw);
    expect(sw).toHaveAttribute("aria-checked", "true");
    await waitFor(() => expect(sw).toHaveAttribute("aria-checked", "false"));
    expect(karta().getByRole("status")).toHaveTextContent(
      "Nie udało się zapisać. Spróbuj ponownie.",
    );
  });

  it("cicha noc: podpis, wyłączenie zapisuje quiet_enabled", async () => {
    pokaz();
    expect(karta().getByText("Bez powiadomień 23:00–07:00")).toBeInTheDocument();
    fireEvent.click(przelacznik("Cicha noc"));
    expect(
      karta().getByText("Wyłączona — powiadomienia przychodzą całą dobę"),
    ).toBeInTheDocument();
    expect(karta().queryByRole("button", { name: "Cicha noc od" })).toBeNull();
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenCalledWith({ quiet_enabled: false }),
    );
  });

  it("cicha noc: wybór godziny „od” zapisuje quiet_from (z quiet_to)", async () => {
    pokaz();
    fireEvent.click(karta().getByRole("button", { name: "Cicha noc od" }));
    fireEvent.click(await screen.findByRole("button", { name: "22" }));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenCalledWith({
        quiet_from: "22:00",
        quiet_to: "07:00",
      }),
    );
    expect(karta().getByText("Bez powiadomień 22:00–07:00")).toBeInTheDocument();
  });

  it("cicha noc: równe godziny → komunikat walidacji, bez zapisu", async () => {
    pokaz();
    fireEvent.click(karta().getByRole("button", { name: "Cicha noc od" }));
    fireEvent.click(await screen.findByRole("button", { name: "07" }));
    expect(
      karta().getByText("Początek i koniec cichej nocy muszą się różnić."),
    ).toBeInTheDocument();
    expect(saveNotificationSettings).not.toHaveBeenCalled();
    // Zmiana minut na inną → zapis i komunikat znika
    fireEvent.click(screen.getByRole("button", { name: ":30" }));
    await waitFor(() =>
      expect(saveNotificationSettings).toHaveBeenCalledWith({
        quiet_from: "07:30",
        quiet_to: "07:00",
      }),
    );
    expect(
      karta().queryByText("Początek i koniec cichej nocy muszą się różnić."),
    ).toBeNull();
  });

  it("„Wyślij testowe” bez włączonych urządzeń → aria-disabled i podpowiedź", () => {
    pokaz({ devices: [{ ...URZADZENIE, enabled: false }] });
    const przycisk = karta().getByRole("button", { name: "Wyślij testowe" });
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    expect(karta().getByRole("status")).toHaveTextContent(
      "Włącz push i co najmniej jedno urządzenie, żeby wysłać test.",
    );
    fireEvent.click(przycisk);
    expect(sendTestPush).not.toHaveBeenCalled();
  });

  it("„Wyślij testowe” przy wyłączonym push tutaj → aria-disabled", () => {
    hook.stan = "wylaczony";
    pokaz();
    expect(
      karta().getByRole("button", { name: "Wyślij testowe" }),
    ).toHaveAttribute("aria-disabled", "true");
  });

  it.each([
    [1, "Wysłano testowe powiadomienie na 1 urządzenie ✓"],
    [2, "Wysłano testowe powiadomienie na 2 urządzenia ✓"],
    [4, "Wysłano testowe powiadomienie na 4 urządzenia ✓"],
    [5, "Wysłano testowe powiadomienie na 5 urządzeń ✓"],
    [12, "Wysłano testowe powiadomienie na 12 urządzeń ✓"],
    [22, "Wysłano testowe powiadomienie na 22 urządzenia ✓"],
  ])("sukces testu dla %i → „%s”", async (n, tekst) => {
    sendTestPush.mockResolvedValue({ ok: true, sent: n });
    pokaz();
    expect(karta().getByRole("status")).toHaveTextContent(
      "Na iPhonie push działa po dodaniu rhytm do ekranu głównego.",
    );
    fireEvent.click(karta().getByRole("button", { name: "Wyślij testowe" }));
    await waitFor(() => expect(karta().getByRole("status")).toHaveTextContent(tekst));
    expect(karta().getByRole("status")).toHaveClass("text-success");
  });

  it("w trakcie wysyłki przycisk zablokowany; limit z akcji w miejscu komunikatu", async () => {
    let zakoncz: (v: unknown) => void = () => {};
    sendTestPush.mockReturnValue(new Promise((r) => (zakoncz = r)));
    pokaz();
    const przycisk = karta().getByRole("button", { name: "Wyślij testowe" });
    fireEvent.click(przycisk);
    expect(przycisk).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(przycisk);
    expect(sendTestPush).toHaveBeenCalledTimes(1);
    await act(async () => {
      zakoncz({ ok: false, message: "Spróbuj ponownie za chwilę." });
    });
    expect(karta().getByRole("status")).toHaveTextContent("Spróbuj ponownie za chwilę.");
    expect(karta().getByRole("status")).toHaveClass("text-destructive-foreground");
    expect(przycisk).toHaveAttribute("aria-disabled", "false");
  });
});

describe("NotificationsTab — wyszarzenie przypomnień nawyków", () => {
  const NAWYK = { id: "h1", name: "Woda 2 l", schedule: "codziennie", remindAt: "12:00" };
  beforeEach(() => {
    vi.clearAllMocks();
    hook.stan = "wlaczony";
    saveNotificationSettings.mockResolvedValue({ ok: true });
  });

  it("wyłączenie „Przypomnienia o nawykach” wyszarza karcie nawyków", async () => {
    pokaz({ habits: [NAWYK] });
    const nawyk = screen.getByRole("switch", { name: "Przypomnienie: Woda 2 l" });
    expect(nawyk).not.toHaveAttribute("aria-disabled");
    fireEvent.click(przelacznik("Przypomnienia o nawykach"));
    expect(nawyk).toHaveAttribute("aria-disabled", "true");
    expect(nawyk).toHaveAttribute("aria-checked", "false");
  });

  it("push wyłączony tutaj → godziny nawyków da się ustawić", () => {
    hook.stan = "wylaczony";
    pokaz({ habits: [NAWYK] });
    expect(screen.getByRole("switch", { name: "Przypomnienie: Woda 2 l" })).not.toHaveAttribute("aria-disabled");
  });
});
