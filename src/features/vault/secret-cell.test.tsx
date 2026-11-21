import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./vault-provider", () => ({ useVault: () => vault.state }));

import { SecretCell } from "./secret-cell";

// Dwa poprawne kształty szyfrogramu (iv 12 B, ct ≥ 16 B); „tekst jawny” zwraca atrapa decrypt
const IV = btoa("iv-dwanascie");
const A = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-A-szesnascie") };
const B = { v: 1, g: 1, iv: IV, ct: btoa("szyfrogram-B-szesnascie") };
const USZKODZONY = { v: 1, g: 1, iv: IV, ct: btoa("uszkodzony-szesnascie") };
const JAWNE: Record<string, string | null> = {
  [A.ct]: "jawne-haslo-A",
  [B.ct]: "jawne-haslo-B",
  [USZKODZONY.ct]: null,
};

function stan(status: string) {
  vault.state = {
    status,
    decrypt: vi.fn(async (v: { ct: string }) => JAWNE[v.ct] ?? null),
  };
}

function schowek(dostepny: { write?: ReturnType<typeof vi.fn>; read?: ReturnType<typeof vi.fn> } | null) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: dostepny === null ? undefined : { writeText: dostepny.write, readText: dostepny.read },
  });
}

describe("SecretCell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stan("odblokowany");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("zablokowany: zablokowane, bez przycisków", () => {
    stan("zablokowany");
    render(<SecretCell value={A} serviceName="GitHub" />);
    expect(screen.getByText("zablokowane")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("null: pusto; brak sejfu: — nieustawiony sejf", () => {
    const { rerender } = render(<SecretCell value={null} serviceName="GitHub" />);
    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    stan("brak");
    rerender(<SecretCell value={A} serviceName="GitHub" />);
    expect(screen.getByText("— nieustawiony sejf")).toBeInTheDocument();
  });

  it("odblokowany: maska, a jawny tekst nie występuje w DOM przed Pokaż", async () => {
    render(<SecretCell value={A} serviceName="GitHub" />);
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();
    await waitFor(() => expect(vault.state.decrypt).toHaveBeenCalled());
    expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
    expect(screen.getByRole("button", { name: "Pokaż hasło" })).toHaveAttribute("aria-pressed", "false");
  });

  it("pokaż przełącza tylko tę komórkę", async () => {
    render(
      <>
        <SecretCell value={A} serviceName="GitHub" />
        <SecretCell value={B} serviceName="Supabase" />
      </>,
    );
    const [pierwsza, druga] = screen.getAllByRole("button", { name: "Pokaż hasło" });
    fireEvent.click(pierwsza);
    expect(await screen.findByText("jawne-haslo-A")).toBeInTheDocument();
    expect(screen.queryByText("jawne-haslo-B")).not.toBeInTheDocument();
    expect(screen.getAllByText("••••••••••••")).toHaveLength(1);
    // Stała etykieta „Pokaż hasło”, stan niesie aria-pressed
    expect(pierwsza).toHaveAttribute("aria-pressed", "true");
    expect(druga).toHaveAttribute("aria-pressed", "false");
    expect(screen.getAllByRole("button", { name: "Pokaż hasło" })).toHaveLength(2);
    // Ponowny klik ukrywa
    fireEvent.click(pierwsza);
    await waitFor(() => expect(screen.queryByText("jawne-haslo-A")).not.toBeInTheDocument());
  });

  it("blokada ukrywa pokazany tekst, a po odblokowaniu znów jest maska", async () => {
    const { rerender } = render(<SecretCell value={A} serviceName="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(await screen.findByText("jawne-haslo-A")).toBeInTheDocument();
    stan("zablokowany");
    rerender(<SecretCell value={A} serviceName="GitHub" />);
    expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
    stan("odblokowany");
    rerender(<SecretCell value={A} serviceName="GitHub" />);
    expect(screen.getByText("••••••••••••")).toBeInTheDocument();
    expect(document.body.innerHTML).not.toContain("jawne-haslo-A");
  });

  it("kopiuj: toast i czyszczenie po 30 s tylko gdy schowek bez zmian", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    const read = vi.fn().mockResolvedValue("jawne-haslo-A");
    schowek({ write, read });
    render(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
    // SHA-256 liczy się asynchronicznie (prawdziwy czas), stąd vi.waitFor
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("jawne-haslo-A"));
    expect(toast).toHaveBeenCalledWith("Skopiowano hasło GitHub", { description: "Schowek wyczyści się za 30 s." });
    // Toast nie zawiera tekstu jawnego
    expect(JSON.stringify(toast.mock.calls)).not.toContain("jawne-haslo-A");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(29_000);
    });
    expect(write).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1_000);
    });
    await vi.waitFor(() => expect(write).toHaveBeenLastCalledWith(""));

    // Użytkownik skopiował coś innego: schowka nie ruszamy
    write.mockClear();
    read.mockResolvedValue("coś innego");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("jawne-haslo-A"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    // Dajemy czas na hash (prawdziwy), po czym sprawdzamy, że czyszczenia nie było
    await vi.waitFor(() => expect(read).toHaveBeenCalledTimes(2));
    vi.useRealTimers();
    await new Promise((r) => setTimeout(r, 50));
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).not.toHaveBeenCalledWith("");
  });

  it("kopiuj: blokada w trakcie odszyfrowywania → nic nie trafia do schowka", async () => {
    const write = vi.fn().mockResolvedValue(undefined);
    schowek({ write });
    const { rerender } = render(<SecretCell value={A} serviceName="GitHub" />);
    await waitFor(() => expect(vault.state.decrypt).toHaveBeenCalledTimes(1));
    let dokoncz: (t: string) => void = () => {};
    (vault.state.decrypt as ReturnType<typeof vi.fn>).mockImplementationOnce(
      () => new Promise<string>((r) => (dokoncz = r)),
    );
    fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    stan("zablokowany");
    rerender(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => dokoncz("jawne-haslo-A"));
    expect(write).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("kopiuj bez readText: po 30 s wpisuje pusty tekst", async () => {
    vi.useFakeTimers();
    const write = vi.fn().mockResolvedValue(undefined);
    schowek({ write });
    render(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("jawne-haslo-A"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    await vi.waitFor(() => expect(write).toHaveBeenLastCalledWith(""));
  });

  it("schowek niedostępny → Nie udało się skopiować.", async () => {
    schowek(null);
    render(<SecretCell value={A} serviceName="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się skopiować."));
    expect(toast).not.toHaveBeenCalled();
  });

  it("odrzucony zapis do schowka → Nie udało się skopiować.", async () => {
    schowek({ write: vi.fn().mockRejectedValue(new Error("odmowa")) });
    render(<SecretCell value={A} serviceName="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Nie udało się skopiować."));
  });

  it("uszkodzony szyfrogram → nie da się odczytać", async () => {
    render(<SecretCell value={USZKODZONY} serviceName="GitHub" />);
    const komunikat = await screen.findByText("nie da się odczytać");
    expect(komunikat).toHaveClass("text-destructive-foreground");
    expect(screen.queryByRole("button", { name: "Pokaż hasło" })).not.toBeInTheDocument();
  });

  it("niepoprawny kształt wartości → nie da się odczytać", () => {
    render(<SecretCell value={{ v: 1, g: 1 }} serviceName="GitHub" />);
    expect(screen.getByText("nie da się odczytać")).toBeInTheDocument();
  });
});
