import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc, loadPage } = vi.hoisted(() => ({ rpc: vi.fn(), loadPage: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc })) }));
vi.mock("@/features/pages/load-page", () => ({ loadPage }));

import { loadPasswordsModule } from "./load-passwords";

describe("loadPasswordsModule", () => {
  beforeEach(() => vi.clearAllMocks());

  it("woła ensure_passwords_page i wczytuje stronę o zwróconym id", async () => {
    rpc.mockResolvedValue({ data: "id-strony", error: null });
    loadPage.mockResolvedValue({ page: { id: "id-strony" } });
    await expect(loadPasswordsModule()).resolves.toEqual({ page: { id: "id-strony" } });
    expect(rpc).toHaveBeenCalledWith("ensure_passwords_page");
    expect(loadPage).toHaveBeenCalledWith("id-strony");
  });

  it("błąd RPC albo brak id: null, bez wczytywania strony", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "x" } });
    await expect(loadPasswordsModule()).resolves.toBeNull();
    rpc.mockResolvedValue({ data: null, error: null });
    await expect(loadPasswordsModule()).resolves.toBeNull();
    expect(loadPage).not.toHaveBeenCalled();
  });
});
