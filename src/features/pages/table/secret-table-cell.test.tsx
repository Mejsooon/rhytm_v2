import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("@/features/vault/vault-provider", () => ({ useVault: () => vault.state }));

import type { PageField } from "../fields";
import { SEJF_ZABLOKOWANY } from "../messages";
import type { PageRow } from "../table-model";
import { SecretTableCell } from "./secret-table-cell";

// Poprawne kształty szyfrogramu (iv 12 B, ct ≥ 16 B); „tekst jawny” zwraca atrapa decrypt
const IV = btoa("iv-dwanascie");
const A = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-A-szesnascie") };
const NOWY = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-nowy-szesnascie") };
const JAWNE: Record<string, string> = { [A.ct]: "jawne-haslo-A" };

const HASLO: PageField = { id: "f-haslo", name: "Hasło", type: "secret", config: {}, position: 2, isTitle: false };

function stan(status: string) {
  vault.state = {
    status,
    decrypt: vi.fn(async (v: { ct: string }) => JAWNE[v.ct] ?? null),
    encrypt: vi.fn(async () => NOWY),
    onStaleGeneration: vi.fn(),
  };
}

function wiersz(v: unknown): PageRow {
  return { id: "row-1", values: { [HASLO.id]: v }, position: 0, deletedAt: null };
}

function komorka(v: unknown, opcje: { readOnly?: boolean; revealed?: boolean; onSave?: (v: unknown) => void } = {}) {
  const onSave = vi.fn(opcje.onSave ?? (() => {}));
  const el = (
    <table>
      <tbody>
        <tr>
          <td>
            <SecretTableCell
              row={wiersz(v)}
              field={HASLO}
              readOnly={opcje.readOnly ?? false}
              revealed={opcje.revealed ?? false}
              onSave={onSave}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
  const wynik = render(el);
  return { ...wynik, onSave };
}

describe("SecretTableCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stan("odblokowany");
    vi.stubGlobal("CSS", { supports: () => true });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("puste: „—”; zablokowany sejf: „zablokowane” bez edycji", () => {
    const { unmount } = komorka(null);
    expect(screen.getByText("—")).toBeInTheDocument();
    unmount();
    stan("zablokowany");
    komorka(A);
    expect(screen.getByText("zablokowane")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("odblokowany: maska, bez tekstu jawnego w DOM", () => {
    komorka(A);
    expect(screen.getByRole("button", { name: "Hasło: zaszyfrowane" })).toHaveTextContent("••••••••••••");
    expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
  });

  it("tylko do odczytu: maska bez przycisku edycji", () => {
    komorka(A, { readOnly: true });
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("klik daje pole bez autouzupełniania z odszyfrowaną wartością", async () => {
    const user = userEvent.setup();
    komorka(A);
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    expect(pole).toHaveValue("jawne-haslo-A");
    expect(pole).toHaveAttribute("data-1p-ignore");
    expect(pole).toHaveAttribute("data-lpignore", "true");
    expect(pole).toHaveAttribute("data-bwignore");
    expect(pole).toHaveAttribute("autocomplete", "off");
    expect(pole).not.toHaveAttribute("name");
    expect(pole).toHaveFocus();
  });

  it("Enter szyfruje i zapisuje SecretValue; tekst jawny znika z DOM", async () => {
    const user = userEvent.setup();
    const { onSave } = komorka(A);
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    await user.clear(pole);
    await user.type(pole, "nowe-tajne{Enter}");
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(NOWY));
    expect(vault.state.encrypt).toHaveBeenCalledWith("nowe-tajne");
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("nowe-tajne");
  });

  it("pusty tekst przy wyjściu daje null bez szyfrowania", async () => {
    const user = userEvent.setup();
    const { onSave } = komorka(A);
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    await user.clear(pole);
    act(() => pole.blur());
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(null));
    expect(vault.state.encrypt).not.toHaveBeenCalled();
  });

  it("bez zmian: wyjście nie zapisuje; Esc kończy bez zapisu", async () => {
    const user = userEvent.setup();
    const { onSave } = komorka(A);
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    await user.type(await screen.findByRole("textbox", { name: "Hasło" }), "{Enter}");
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    await user.type(await screen.findByRole("textbox", { name: "Hasło" }), "zmiana{Escape}");
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
    expect(vault.state.encrypt).not.toHaveBeenCalled();
  });

  it("błąd szyfrowania: toast i bez zapisu", async () => {
    const user = userEvent.setup();
    (vault.state.encrypt as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("brak klucza"));
    const { onSave } = komorka(null);
    await user.click(screen.getByRole("button", { name: "Hasło: puste" }));
    await user.type(await screen.findByRole("textbox", { name: "Hasło" }), "tajne{Enter}");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(SEJF_ZABLOKOWANY));
    expect(onSave).not.toHaveBeenCalled();
    expect(document.body.innerHTML).not.toContain("tajne");
  });

  it("Review Focus 1: blokada w trakcie edycji — bez zapisu, toast i wyczyszczone pole", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const { rerender } = komorka(A, { onSave });
    await user.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    await user.type(await screen.findByRole("textbox", { name: "Hasło" }), "-dopisek");
    stan("zablokowany");
    rerender(
      <table>
        <tbody>
          <tr>
            <td>
              <SecretTableCell row={wiersz(A)} field={HASLO} readOnly={false} revealed={false} onSave={onSave} />
            </td>
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("zablokowane")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
    expect(toast.error).toHaveBeenCalledWith(SEJF_ZABLOKOWANY);
    expect(onSave).not.toHaveBeenCalled();
  });

  it("revealed: pokazuje odszyfrowany tekst zamiast maski", async () => {
    komorka(A, { revealed: true });
    expect(await screen.findByText("jawne-haslo-A")).toBeInTheDocument();
    expect(screen.queryByText("••••••••••••")).not.toBeInTheDocument();
  });

  it("revealed w edycji: pole bez maski CSS", async () => {
    komorka(A, { revealed: true });
    fireEvent.click(await screen.findByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    expect(pole.className).not.toContain("text-security");
  });

  it("przeglądarka bez maskowania CSS: pole type=password z autocomplete new-password", async () => {
    vi.stubGlobal("CSS", { supports: () => false });
    komorka(A);
    fireEvent.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    await waitFor(() => expect(screen.getByLabelText("Hasło")).toHaveAttribute("type", "password"));
    expect(screen.getByLabelText("Hasło")).toHaveAttribute("autocomplete", "new-password");
  });

  it("zamaskowane pole blokuje kopiowanie i wycinanie; odsłonięte nie", async () => {
    komorka(A);
    fireEvent.click(screen.getByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    expect(fireEvent.copy(pole)).toBe(false);
    expect(fireEvent.cut(pole)).toBe(false);
  });

  it("odsłonięte pole pozwala kopiować", async () => {
    komorka(A, { revealed: true });
    fireEvent.click(await screen.findByRole("button", { name: "Hasło: zaszyfrowane" }));
    const pole = await screen.findByRole("textbox", { name: "Hasło" });
    expect(fireEvent.copy(pole)).toBe(true);
  });

  it("brak sejfu przy niepustej wartości: „— nieustawiony sejf”", () => {
    stan("brak");
    komorka(A);
    expect(screen.getByText("— nieustawiony sejf")).toBeInTheDocument();
  });

  it("bez akcji modułu: bez oczka i kopiowania", () => {
    komorka(A);
    expect(screen.queryByRole("button", { name: "Pokaż hasło" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kopiuj hasło" })).not.toBeInTheDocument();
  });
});
