import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));

import type { PageField } from "../../fields";
import { SEJF_ZABLOKOWANY } from "../../messages";
import { MRowSheet } from "./m-row-sheet";

const IV = btoa("iv-dwanascie");
const A = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-A-szesnascie") };
const NOWY = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-nowy-szesnascie") };
const JAWNE: Record<string, string> = { [A.ct]: "jawne-haslo-A" };

const POLA: PageField[] = [
  { id: "f-serwis", name: "Serwis", type: "text", config: {}, position: 0, isTitle: true },
  { id: "f-haslo", name: "Hasło", type: "secret", config: {}, position: 1, isTitle: false },
];

function stan(status: string) {
  vault.state = {
    status,
    decrypt: vi.fn(async (v: { ct: string }) => JAWNE[v.ct] ?? null),
    encrypt: vi.fn(async () => NOWY),
  };
}

function arkusz(values: Record<string, unknown> = { "f-serwis": "GitHub", "f-haslo": A }) {
  const onChange = vi.fn();
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const el = (open: boolean) => (
    <MRowSheet
      open={open}
      title="GitHub"
      fields={POLA}
      values={values}
      today="2026-11-15"
      onChange={onChange}
      onSave={onSave}
      onCancel={onCancel}
    />
  );
  const wynik = render(el(true));
  return { ...wynik, onChange, onSave, onCancel, zamknij: () => wynik.rerender(el(false)), otworz: () => wynik.rerender(el(true)) };
}

describe("MRowSheet: Sekret", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stan("odblokowany");
    vi.stubGlobal("CSS", { supports: () => true });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("pole zamaskowane bez autouzupełniania, z odszyfrowaną wartością", async () => {
    arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    await waitFor(() => expect(pole).toHaveValue("jawne-haslo-A"));
    expect(pole.className).toContain("text-security");
    expect(pole).toHaveAttribute("data-1p-ignore");
    expect(pole).toHaveAttribute("data-lpignore", "true");
    expect(pole).toHaveAttribute("data-bwignore");
    expect(pole).toHaveAttribute("autocomplete", "off");
    fireEvent.click(screen.getByRole("button", { name: "Pokaż: Hasło" }));
    expect(pole.className).not.toContain("text-security");
  });

  it("„Zapisz” szyfruje zmieniony sekret; onChange nie dostaje tekstu jawnego", async () => {
    const user = userEvent.setup();
    const { onSave, onChange } = arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    await waitFor(() => expect(pole).toHaveValue("jawne-haslo-A"));
    await user.clear(pole);
    await user.type(pole, "nowe-tajne");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ "f-haslo": NOWY }));
    expect(vault.state.encrypt).toHaveBeenCalledWith("nowe-tajne");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("bez zmian sekretu „Zapisz” nie szyfruje; pusty tekst daje null", async () => {
    const user = userEvent.setup();
    const { onSave } = arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    await waitFor(() => expect(pole).toHaveValue("jawne-haslo-A"));
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({}));
    onSave.mockClear();
    await user.clear(pole);
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ "f-haslo": null }));
    expect(vault.state.encrypt).not.toHaveBeenCalled();
  });

  it("błąd szyfrowania: toast, bez zapisu", async () => {
    const user = userEvent.setup();
    (vault.state.encrypt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("brak klucza"));
    const { onSave } = arkusz({ "f-serwis": "GitHub", "f-haslo": null });
    await user.type(screen.getByRole("textbox", { name: "Hasło" }), "tajne");
    await user.click(screen.getByRole("button", { name: "Zapisz" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SEJF_ZABLOKOWANY));
    expect(onSave).not.toHaveBeenCalled();
  });

  it("zamknięty sejf: pole wyłączone, bez tekstu jawnego, oczka i kopiowania", () => {
    stan("zablokowany");
    arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    expect(pole).toBeDisabled();
    expect(pole).toHaveValue("");
    expect(pole).toHaveAttribute("placeholder", "zablokowane");
    expect(screen.queryByRole("button", { name: "Pokaż: Hasło" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kopiuj: Hasło" })).not.toBeInTheDocument();
    expect(vault.state.decrypt).not.toHaveBeenCalled();
  });

  it("zamknięcie arkusza czyści tekst jawny", async () => {
    const user = userEvent.setup();
    const { zamknij, otworz } = arkusz({ "f-serwis": "GitHub", "f-haslo": null });
    await user.type(screen.getByRole("textbox", { name: "Hasło" }), "tajne");
    zamknij();
    otworz();
    expect(screen.getByRole("textbox", { name: "Hasło" })).toHaveValue("");
  });

  it("kopiowanie: schowek z tekstem i czyszczenie po 30 s", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    await waitFor(() => expect(pole).toHaveValue("jawne-haslo-A"));
    vi.useFakeTimers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj: Hasło" }));
    });
    expect(writeText).toHaveBeenCalledWith("jawne-haslo-A");
    expect(toast).toHaveBeenCalledWith("Skopiowano: Hasło", { description: "Schowek wyczyści się za 30 s." });
    act(() => vi.advanceTimersByTime(30_000));
    expect(writeText).toHaveBeenLastCalledWith("");
  });
});
