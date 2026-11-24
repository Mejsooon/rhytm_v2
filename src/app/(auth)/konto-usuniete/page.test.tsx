import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, maybeSingle } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle }) }) }),
  }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
  unstable_rethrow: () => {},
}));
vi.mock("@/features/settings/account-actions", () => ({
  restoreAccount: vi.fn(),
}));
vi.mock("@/features/auth/actions", () => ({ signOut: vi.fn() }));

import { AuthShell } from "@/components/auth/auth-shell";

import KontoUsunietePage from "./page";

// Komponent pod Suspense (async Ekran) wywołany bezpośrednio
async function ekran() {
  const strona = KontoUsunietePage();
  const zawieszone = strona.props.children;
  const Ekran = zawieszone.props.children.type as () => Promise<
    React.ReactElement
  >;
  return Ekran();
}

describe("/konto-usuniete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "ala@example.com" } },
    });
  });

  it("ramka konta jest korzeniem strony, treść pod Suspense", () => {
    expect(KontoUsunietePage().type).toBe(AuthShell);
  });

  it("data trwałego usunięcia = prośba + 30 dni po polsku i trzy przyciski", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        deletion_requested_at: "2026-11-24T10:00:00Z",
        timezone: "Europe/Warsaw",
      },
      error: null,
    });
    render(await ekran());
    expect(
      screen.getByRole("heading", { name: "Konto czeka na usunięcie" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/zostanie trwale usunięte/).textContent,
    ).toBe(
      "Konto ala@example.com zostanie trwale usunięte 24 grudnia 2026 (30 dni od prośby o usunięcie). Do tego czasu możesz je przywrócić.",
    );
    expect(
      screen.getByRole("button", { name: "Przywróć konto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Pobierz dane (.json)" }),
    ).toHaveAttribute("href", "/api/eksport");
    expect(screen.getByRole("button", { name: "Wyloguj" })).toBeInTheDocument();
  });

  it("bez prośby o usunięcie → /dzis", async () => {
    maybeSingle.mockResolvedValue({
      data: { deletion_requested_at: null, timezone: "Europe/Warsaw" },
      error: null,
    });
    await expect(ekran()).rejects.toThrow("REDIRECT:/dzis");
  });

  it("bez sesji → /logowanie", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    await expect(ekran()).rejects.toThrow("REDIRECT:/logowanie");
  });
});
