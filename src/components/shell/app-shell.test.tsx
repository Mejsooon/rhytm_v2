import { beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, maybeSingle, select } = vi.hoisted(() => ({
  getUser: vi.fn(),
  maybeSingle: vi.fn(),
  select: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from: () => ({
      select: (kolumny: string) => {
        select(kolumny);
        return { eq: () => ({ maybeSingle }) };
      },
    }),
  }),
}));
vi.mock("next/server", () => ({ connection: async () => {} }));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));
vi.mock("@/features/pages/load-pages", () => ({ loadPages: async () => [] }));
vi.mock("@/features/profile/avatar-url", () => ({
  getAvatarUrl: async () => null,
}));
vi.mock("@/features/vault/vault-provider", () => ({
  VaultProvider: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("./app-sidebar", () => ({ AppSidebar: () => null }));
vi.mock("./sidebar-state", () => ({
  SidebarStateProvider: ({ children }: { children: React.ReactNode }) =>
    children,
}));
vi.mock("./tab-bar", () => ({ TabBar: () => null }));

import { AppShell } from "./app-shell";

// Powłoka pod Suspense (async) wywołana bezpośrednio
async function powloka() {
  const korzen = AppShell({ children: "treść" });
  const zawieszona = korzen.props.children.props.children;
  return zawieszona.type(zawieszona.props);
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: { user: { id: "u1", email: "ala@example.com" } },
    });
  });

  it("konto oznaczone do usunięcia → /konto-usuniete (przekierowanie z akcji omija proxy)", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        display_name: "Ala",
        avatar_path: null,
        deletion_requested_at: "2026-11-24T10:00:00Z",
      },
      error: null,
    });
    await expect(powloka()).rejects.toThrow("REDIRECT:/konto-usuniete");
  });

  it("konto aktywne → powłoka się renderuje", async () => {
    maybeSingle.mockResolvedValue({
      data: {
        display_name: "Ala",
        avatar_path: null,
        deletion_requested_at: null,
      },
      error: null,
    });
    await expect(powloka()).resolves.toBeTruthy();
    expect(select).toHaveBeenCalledTimes(1);
  });

  it("stara baza (42703) → drugie zapytanie bez kolumny, bez przekierowania", async () => {
    maybeSingle
      .mockResolvedValueOnce({ data: null, error: { code: "42703" } })
      .mockResolvedValueOnce({
        data: { display_name: "Ala", avatar_path: null },
        error: null,
      });
    await expect(powloka()).resolves.toBeTruthy();
    expect(select).toHaveBeenNthCalledWith(2, "display_name, avatar_path");
  });
});
