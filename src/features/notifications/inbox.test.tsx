import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadInbox, markRead, push, toastError } = vi.hoisted(() => ({
  // Odpowiedź GET /api/powiadomienia
  loadInbox: vi.fn(),
  markRead: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("./inbox-actions", () => ({ markRead }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { NotificationBell } from "./inbox";

const wpis = (id: string, title: string, createdAt: string, read: boolean) => ({
  id,
  kind: "habit" as const,
  title,
  body: "Przypomnienie nawyku",
  url: `/nawyki/${id}`,
  createdAt,
  read,
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", async () => ({ ok: true, json: () => loadInbox() }));
  markRead.mockResolvedValue({ ok: true });
  loadInbox.mockResolvedValue({
    timeZone: "Europe/Warsaw",
    items: [
      wpis("a", "Pora na: Woda", new Date().toISOString(), false),
      wpis("b", "Pora na: Czytanie", "2026-01-05T10:00:00Z", true),
    ],
  });
});

async function otworz() {
  const user = userEvent.setup();
  render(<NotificationBell />);
  await user.click(await screen.findByRole("button", { name: "Powiadomienia, 1 nieprzeczytane" }));
  return user;
}

describe("NotificationBell", () => {
  it("grupuje na Dziś i Wcześniej; filtr pokazuje tylko nieprzeczytane", async () => {
    const user = await otworz();
    expect(screen.getByText("Dziś")).toBeInTheDocument();
    expect(screen.getByText("Wcześniej")).toBeInTheDocument();
    expect(screen.getByText("05.01")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Nieprzeczytane/ }));
    expect(screen.queryByText("Pora na: Czytanie")).toBeNull();
  });

  it("klik oznacza jako przeczytane i otwiera miejsce", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("button", { name: /Pora na: Woda/ }));
    expect(markRead).toHaveBeenCalledWith(["a"]);
    expect(push).toHaveBeenCalledWith("/nawyki/a");
  });

  it("„Oznacz wszystkie” czyści kropkę; przy błędzie wraca stan z serwera", async () => {
    markRead.mockResolvedValue({ ok: false });
    const user = await otworz();
    await user.click(screen.getByRole("button", { name: "Oznacz wszystkie jako przeczytane" }));
    expect(markRead).toHaveBeenCalledWith(["a"]);
    expect(await screen.findByRole("img", { name: "nieprzeczytane" })).toBeInTheDocument();
    expect(toastError).toHaveBeenCalled();
  });

  it("pusta lista ma własny komunikat", async () => {
    loadInbox.mockResolvedValue({ timeZone: "Europe/Warsaw", items: [] });
    const user = userEvent.setup();
    render(<NotificationBell />);
    await user.click(screen.getByRole("button", { name: "Powiadomienia" }));
    expect(await screen.findByText("Nie masz jeszcze powiadomień")).toBeInTheDocument();
  });
});
