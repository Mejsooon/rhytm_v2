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

  it("zamaskowane pole blokuje kopiowanie i wycinanie; po oczku nie", () => {
    arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    expect(fireEvent.copy(pole)).toBe(false);
    expect(fireEvent.cut(pole)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż: Hasło" }));
    expect(fireEvent.copy(pole)).toBe(true);
  });
});

// Subscriptions na telefonie (minimum do Etapu 3): kwota z segmentem cyklu i data z dopiskiem następnego odnowienia
describe("MRowSheet: Subscriptions", () => {
  const SUB: PageField[] = [
    { id: "k", name: "Kwota cykliczna", type: "recurring", config: { default_cycle: "month" }, position: 0, isTitle: false },
    { id: "o", name: "Data odnowienia", type: "renewal", config: { cycle_field_id: "k" }, position: 1, isTitle: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    stan("zablokowany");
  });

  function arkuszSub(values: Record<string, unknown>, fields: PageField[] = SUB, allFields?: PageField[]) {
    const onChange = vi.fn();
    render(
      <MRowSheet
        open
        title="Netflix"
        fields={fields}
        allFields={allFields}
        values={values}
        today="2026-11-15"
        onChange={onChange}
        onSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    );
    return { onChange };
  }

  it("kwota: pole liczby zapisuje {amount, cycle}, segment „mies. | rok” zmienia cykl", async () => {
    const user = userEvent.setup();
    const { onChange } = arkuszSub({ k: { amount: 43, cycle: "month" } });
    const pole = screen.getByRole("textbox", { name: "Kwota cykliczna" });
    expect(pole).toHaveValue("43,00");
    expect(pole).toHaveAttribute("inputmode", "decimal");
    await user.clear(pole);
    expect(onChange).toHaveBeenLastCalledWith("k", null);
    await user.type(pole, "29,99");
    expect(onChange).toHaveBeenLastCalledWith("k", { amount: 29.99, cycle: "month" });
    const segment = screen.getByRole("radiogroup", { name: "Kwota cykliczna: cykl" });
    expect(screen.getByRole("radio", { name: "mies." })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("radio", { name: "rok" }));
    expect(segment).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith("k", { amount: 43, cycle: "year" });
  });

  it("data odnowienia: pole pokazuje następne odnowienie, nie kotwicę", () => {
    arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    expect(screen.getByRole("button", { name: "Data odnowienia" })).toHaveTextContent("21.11.2026");
    expect(screen.queryByText(/następne:/)).not.toBeInTheDocument();
  });

  it("cykl bierze się z ukrytej kolumny kwoty (allFields)", () => {
    arkuszSub({ k: { amount: 249.99, cycle: "year" }, o: "2025-12-03" }, [SUB[1]], SUB);
    expect(screen.getByRole("button", { name: "Data odnowienia" })).toHaveTextContent("03.12.2026");
  });

  it("wybrana data staje się nową kotwicą", async () => {
    const user = userEvent.setup();
    const { onChange } = arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    await user.click(screen.getByRole("button", { name: "Data odnowienia" }));
    await user.click(screen.getByRole("button", { name: /25/ }));
    expect(onChange).toHaveBeenLastCalledWith("o", "2026-11-25");
  });

  it("ponowny wybór daty z serii nie zapisuje nowej kotwicy", async () => {
    const user = userEvent.setup();
    const { onChange } = arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    await user.click(screen.getByRole("button", { name: "Data odnowienia" }));
    await user.click(screen.getByRole("button", { name: /21/ }));
    expect(onChange).not.toHaveBeenCalledWith("o", expect.anything());
  });
});

