import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { sendFeedback, firstStepsCount, setFirstStepsHidden, push, toastError } = vi.hoisted(() => ({
  sendFeedback: vi.fn(),
  firstStepsCount: vi.fn(),
  setFirstStepsHidden: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("./actions", () => ({ sendFeedback, firstStepsCount }));
vi.mock("@/features/today/actions", () => ({ setFirstStepsHidden }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh: vi.fn() }), usePathname: () => "/kalendarz" }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { HelpMenu } from "./help-menu";

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  firstStepsCount.mockResolvedValue(1);
  setFirstStepsHidden.mockResolvedValue({ ok: true });
});

async function zMenu(pozycja: string | RegExp) {
  const user = userEvent.setup();
  render(<HelpMenu email="a@example.com" />);
  await user.click(screen.getByRole("button", { name: "Pomoc i opinie" }));
  await user.click(await screen.findByRole("button", { name: pozycja }));
  return user;
}

describe("HelpMenu", () => {
  it("błąd: dołącza ekran i wersję, a po wysłaniu dziękuje", async () => {
    sendFeedback.mockResolvedValue({ ok: true });
    const user = await zMenu("Zgłoś błąd");
    const wyslij = screen.getByRole("button", { name: "Wyślij" });
    expect(wyslij).toBeDisabled();
    await user.type(screen.getByRole("textbox", { name: "Co się stało?" }), "Nic nie klika");
    await user.click(wyslij);
    expect(sendFeedback).toHaveBeenCalledWith({
      kind: "bug",
      message: "Nic nie klika",
      contact: true,
      context: expect.objectContaining({ screen: "Kalendarz", version: "0.1.0" }),
    });
    expect(screen.getByText("Jeśli kontakt był zaznaczony, odpiszemy na a@example.com.")).toBeInTheDocument();
  });

  it("przy błędzie zapisu treść zostaje; opinia nie dołącza danych o przeglądarce", async () => {
    sendFeedback.mockResolvedValue({ ok: false, message: "Nie udało się wysłać. Spróbuj ponownie." });
    const user = await zMenu("Wyślij opinię");
    await user.type(screen.getByRole("textbox", { name: "Co by Ci pomogło?" }), "Tablica");
    await user.click(screen.getByRole("button", { name: "Wyślij" }));
    expect(sendFeedback).toHaveBeenCalledWith(expect.objectContaining({ kind: "idea", context: {} }));
    expect(toastError).toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Co by Ci pomogło?" })).toHaveValue("Tablica");
  });

  it("„Pierwsze kroki” pokazują licznik, przywracają kartę i prowadzą na Dziś", async () => {
    await zMenu(/Pierwsze kroki\s*1 \/ 6/);
    expect(setFirstStepsHidden).toHaveBeenCalledWith(false);
    expect(push).toHaveBeenCalledWith("/dzis");
  });

  it("„?” otwiera skróty, ale nie w polu tekstowym; ⌘⇧K prowadzi do szybkiego dodawania", () => {
    render(
      <>
        <input aria-label="pole" />
        <HelpMenu email="a@example.com" />
      </>,
    );
    fireEvent.keyDown(screen.getByRole("textbox", { name: "pole" }), { key: "?" });
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "K", ctrlKey: true, shiftKey: true });
    expect(push).toHaveBeenCalledWith("/dzis?szybko=dodaj");
    fireEvent.keyDown(window, { key: "?" });
    expect(screen.getByRole("dialog", { name: "Skróty klawiszowe" })).toBeInTheDocument();
  });
});
