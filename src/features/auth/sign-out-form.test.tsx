import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("./actions", () => ({ signOut }));

import { SignOutForm } from "./sign-out-form";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";

function ustawServiceWorker(subskrypcja: unknown) {
  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      getRegistration: vi.fn(async () => ({
        pushManager: { getSubscription: vi.fn(async () => subskrypcja) },
      })),
    },
  });
}

function wyslij() {
  render(
    <SignOutForm>
      <button type="submit">Wyloguj</button>
    </SignOutForm>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Wyloguj" }));
}

describe("SignOutForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    signOut.mockResolvedValue(undefined);
  });
  afterEach(() => {
    // jsdom nie ma service workera — przywracamy brak
    delete (navigator as unknown as Record<string, unknown>).serviceWorker;
  });

  it("subskrypcja push → unsubscribe i endpoint w danych akcji", async () => {
    const unsubscribe = vi.fn(async () => true);
    ustawServiceWorker({ endpoint: ENDPOINT, unsubscribe });
    wyslij();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect(unsubscribe).toHaveBeenCalled();
    const fd = signOut.mock.calls[0][0] as FormData;
    expect(fd.get("push_endpoint")).toBe(ENDPOINT);
  });

  it("nieudane unsubscribe nie blokuje wylogowania", async () => {
    ustawServiceWorker({
      endpoint: ENDPOINT,
      unsubscribe: vi.fn(async () => {
        throw new Error("x");
      }),
    });
    wyslij();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect((signOut.mock.calls[0][0] as FormData).get("push_endpoint")).toBe(
      ENDPOINT,
    );
  });

  it("bez service workera → wylogowanie bez endpointu", async () => {
    wyslij();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect((signOut.mock.calls[0][0] as FormData).get("push_endpoint")).toBeNull();
  });

  it("brak subskrypcji → wylogowanie bez endpointu", async () => {
    ustawServiceWorker(null);
    wyslij();
    await waitFor(() => expect(signOut).toHaveBeenCalled());
    expect((signOut.mock.calls[0][0] as FormData).get("push_endpoint")).toBeNull();
  });
});
