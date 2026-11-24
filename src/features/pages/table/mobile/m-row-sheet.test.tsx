import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

  it("zamaskowane pole blokuje kopiowanie i wycinanie; po oczku nie", async () => {
    arkusz();
    const pole = screen.getByRole("textbox", { name: "Hasło" });
    // Czekamy na odszyfrowanie (stan arkusza zmienia się po mikrozadaniach), zamiast liczyć na ich kolejność
    await waitFor(() => expect(pole).toHaveValue("jawne-haslo-A"));
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

  it("data odnowienia: kalendarz pokazuje następne odnowienie (nie kotwicę), z podpisem „dd.mm.rrrr · za N dni”", () => {
    arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    const grupa = screen.getByRole("group", { name: "Data odnowienia" });
    expect(within(grupa).getByText("listopad 2026")).toBeInTheDocument();
    expect(within(grupa).getByRole("button", { name: "21 listopada 2026" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupa).getByText("21.11.2026 · za 6 dni")).toBeInTheDocument();
  });

  it("cykl bierze się z ukrytej kolumny kwoty (allFields)", () => {
    arkuszSub({ k: { amount: 249.99, cycle: "year" }, o: "2025-12-03" }, [SUB[1]], SUB);
    const grupa = screen.getByRole("group", { name: "Data odnowienia" });
    expect(within(grupa).getByText("grudzień 2026")).toBeInTheDocument();
    expect(within(grupa).getByText("03.12.2026 · za 18 dni")).toBeInTheDocument();
  });

  it("wybrana data staje się nową kotwicą", async () => {
    const user = userEvent.setup();
    const { onChange } = arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    await user.click(screen.getByRole("button", { name: "25 listopada 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("o", "2026-11-25");
  });

  it("ponowny wybór daty z serii nie zapisuje nowej kotwicy", async () => {
    const user = userEvent.setup();
    const { onChange } = arkuszSub({ k: { amount: 43, cycle: "month" }, o: "2026-10-21" });
    await user.click(screen.getByRole("button", { name: "21 listopada 2026" }));
    expect(onChange).not.toHaveBeenCalledWith("o", expect.anything());
  });
});


// Układ według CMRowEdit: nagłówek „Anuluj · tytuł · Zapisz”, chipy Wyboru, karta z przełącznikami, „Usuń wiersz”
describe("MRowSheet: układ CMRowEdit", () => {
  const OPCJE = [
    { id: "o1", label: "Rozrywka", color: "#0070f3" },
    { id: "o2", label: "Praca", color: "#15803d" },
  ];
  const POLA_UKLADU: PageField[] = [
    { id: "n", name: "Nazwa", type: "text", config: {}, position: 0, isTitle: true },
    { id: "kat", name: "Kategoria", type: "select", config: { options: OPCJE }, position: 1, isTitle: false },
    { id: "akt", name: "Aktywna", type: "checkbox", config: {}, position: 2, isTitle: false },
    { id: "zrobione", name: "Zrobione", type: "checkbox", config: {}, position: 3, isTitle: false },
    { id: "ocena", name: "Ocena", type: "rating", config: {}, position: 4, isTitle: false },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    stan("zablokowany");
  });

  function uklad(values: Record<string, unknown>, onDelete?: () => void) {
    const onChange = vi.fn();
    const onCancel = vi.fn();
    render(
      <MRowSheet
        open
        title="Netflix"
        fields={POLA_UKLADU}
        values={values}
        today="2026-11-15"
        onChange={onChange}
        onSave={vi.fn()}
        onCancel={onCancel}
        onDelete={onDelete}
      />,
    );
    return { onChange, onCancel };
  }

  it("arkusz ma 90% wysokości; nagłówek „Anuluj · tytuł · Zapisz”, bez stopki", () => {
    const { onCancel } = uklad({ n: "Netflix" });
    const arkusz = screen.getByRole("dialog", { name: "Netflix" });
    expect(arkusz.className).toContain("max-[799px]:h-[90%]");
    expect(screen.getAllByRole("button", { name: "Anuluj" })).toHaveLength(1);
    expect(screen.getAllByRole("button", { name: "Zapisz" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onCancel).toHaveBeenCalled();
  });

  it("Wybór to chipy z aria-pressed; stuknięcie zaznaczonej opcji ją czyści", async () => {
    const user = userEvent.setup();
    const { onChange } = uklad({ n: "Netflix", kat: "o1" });
    const grupa = screen.getByRole("group", { name: "Kategoria" });
    expect(within(grupa).getByRole("button", { name: "Rozrywka" })).toHaveAttribute("aria-pressed", "true");
    expect(within(grupa).getByRole("button", { name: "Praca" })).toHaveAttribute("aria-pressed", "false");
    await user.click(within(grupa).getByRole("button", { name: "Praca" }));
    expect(onChange).toHaveBeenLastCalledWith("kat", "o2");
    await user.click(within(grupa).getByRole("button", { name: "Rozrywka" }));
    expect(onChange).toHaveBeenLastCalledWith("kat", null);
  });

  it("checkboxy są razem w jednej karcie jako przełączniki m-row", async () => {
    const user = userEvent.setup();
    const { onChange } = uklad({ n: "Netflix", akt: true });
    const akt = screen.getByRole("switch", { name: "Aktywna" });
    const zrobione = screen.getByRole("switch", { name: "Zrobione" });
    expect(akt).toHaveAttribute("aria-checked", "true");
    expect(akt.parentElement).toHaveClass("m-row");
    expect(akt.parentElement!.parentElement).toBe(zrobione.parentElement!.parentElement);
    await user.click(zrobione);
    expect(onChange).toHaveBeenLastCalledWith("zrobione", true);
  });

  it("„Usuń wiersz” (destructive-outline na całą szerokość) tylko dla istniejącego wiersza", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const { unmount } = render(
      <MRowSheet open title="A" fields={POLA_UKLADU} values={{}} today="2026-11-15" onChange={vi.fn()} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Usuń wiersz" })).toBeNull();
    unmount();
    uklad({ n: "Netflix" }, onDelete);
    const usun = screen.getByRole("button", { name: "Usuń wiersz" });
    expect(usun).toHaveClass("w-full");
    await user.click(usun);
    expect(onDelete).toHaveBeenCalled();
  });

  it("data: kalendarz z nawigacją miesięcy; dziś na czerwono, podpis pod kartą", async () => {
    const user = userEvent.setup();
    const pola: PageField[] = [{ id: "d", name: "Termin", type: "date", config: {}, position: 0, isTitle: false }];
    const onChange = vi.fn();
    render(
      <MRowSheet open title="A" fields={pola} values={{ d: "2026-11-20" }} today="2026-11-15" onChange={onChange} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    const grupa = screen.getByRole("group", { name: "Termin" });
    expect(within(grupa).getByText("20.11.2026 · za 5 dni")).toBeInTheDocument();
    expect(within(grupa).getByRole("button", { name: "15 listopada 2026" }).className).toContain("bg-[#dc2626]");
    expect(within(grupa).getByRole("button", { name: "20 listopada 2026" })).toHaveAttribute("aria-pressed", "true");
    await user.click(within(grupa).getByRole("button", { name: "Następny miesiąc" }));
    expect(within(grupa).getByText("grudzień 2026")).toBeInTheDocument();
    await user.click(within(grupa).getByRole("button", { name: "3 grudnia 2026" }));
    expect(onChange).toHaveBeenLastCalledWith("d", "2026-12-03");
  });

  it("ocena: gwiazdki 44 px", () => {
    uklad({ n: "Netflix", ocena: 3 });
    const gwiazdka = screen.getByRole("button", { name: "Ocena 2 na 5" });
    expect(gwiazdka).toHaveClass("size-11");
    expect(gwiazdka).toHaveAttribute("aria-pressed", "true");
  });
});
