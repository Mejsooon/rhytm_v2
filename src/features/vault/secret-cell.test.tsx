import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock("sonner", () => ({ toast }));

const vault = vi.hoisted(() => ({ state: {} as Record<string, unknown> }));
vi.mock("./vault-provider", () => ({ useVault: () => vault.state }));

import { SecretCell, SecretEdit } from "./secret-cell";

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
    vi.restoreAllMocks();
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

  it("kopiuj: toast, a po 30 s (z fokusem) czyszczenie schowka bez readText", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const write = vi.fn().mockResolvedValue(undefined);
    const read = vi.fn().mockResolvedValue("jawne-haslo-A");
    schowek({ write, read });
    render(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
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
    expect(write).toHaveBeenLastCalledWith("");
    expect(write).toHaveBeenCalledTimes(2);
    // Schowka nie czytamy
    expect(read).not.toHaveBeenCalled();
  });

  it("kopiuj bez fokusu: po 30 s czeka na powrót do karty i dopiero wtedy czyści", async () => {
    vi.useFakeTimers();
    const fokus = vi.spyOn(document, "hasFocus").mockReturnValue(false);
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
    expect(write).not.toHaveBeenCalledWith("");
    fokus.mockReturnValue(true);
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(write).toHaveBeenLastCalledWith("");
    // Nasłuch jednorazowy: kolejny focus nic nie robi
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("kopiuj, a potem blokada przed upływem 30 s: schowek czyszczony od razu", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const write = vi.fn().mockResolvedValue(undefined);
    schowek({ write });
    const { rerender } = render(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("jawne-haslo-A"));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    stan("zablokowany");
    rerender(<SecretCell value={A} serviceName="GitHub" />);
    expect(write).toHaveBeenLastCalledWith("");
    // Zaplanowane czyszczenie po 30 s już się nie powtarza
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("kopiuj, a potem odmontowanie komórki: schowek czyszczony od razu", async () => {
    vi.useFakeTimers();
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    const write = vi.fn().mockResolvedValue(undefined);
    schowek({ write });
    const { unmount } = render(<SecretCell value={A} serviceName="GitHub" />);
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Kopiuj hasło" }));
    });
    await vi.waitFor(() => expect(write).toHaveBeenCalledWith("jawne-haslo-A"));
    unmount();
    expect(write).toHaveBeenLastCalledWith("");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30_000);
    });
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("odsłonięty tekst ma translate=no i notranslate", async () => {
    render(<SecretCell value={A} serviceName="GitHub" />);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    const tekst = await screen.findByText("jawne-haslo-A");
    expect(tekst).toHaveAttribute("translate", "no");
    expect(tekst).toHaveClass("notranslate");
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

describe("SecretEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stan("odblokowany");
  });

  function pole(text = "tajne") {
    render(
      <SecretEdit
        fieldId="f1"
        label="Hasło"
        source={null}
        text={text}
        onText={() => {}}
        onPrefill={() => {}}
        onSubmit={() => {}}
        onCancel={() => {}}
      />,
    );
    return screen.getByLabelText("Hasło");
  }

  it("pole tekstowe z maskowaniem CSS, wyłączone podpowiedzi i menedżery haseł, bez name", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const p = pole();
    expect(p).toHaveAttribute("type", "text");
    expect(p).toHaveClass("[-webkit-text-security:disc]");
    expect(p).toHaveAttribute("autocomplete", "off");
    expect(p).toHaveAttribute("spellcheck", "false");
    expect(p).toHaveAttribute("autocapitalize", "off");
    expect(p).toHaveAttribute("autocorrect", "off");
    expect(p).toHaveAttribute("data-1p-ignore");
    expect(p).toHaveAttribute("data-lpignore", "true");
    expect(p).toHaveAttribute("data-bwignore");
    expect(p).toHaveAttribute("data-form-type", "other");
    expect(p).toHaveAttribute("translate", "no");
    expect(p).not.toHaveAttribute("name");
  });

  it("Pokaż zdejmuje maskowanie", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const p = pole();
    fireEvent.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(p).toHaveAttribute("type", "text");
    expect(p).not.toHaveClass("[-webkit-text-security:disc]");
  });

  it("przeglądarka bez maskowania CSS: type=password, a Pokaż przełącza na tekst", () => {
    vi.stubGlobal("CSS", { supports: () => false });
    const p = pole();
    expect(p).toHaveAttribute("type", "password");
    expect(p).toHaveAttribute("autocomplete", "new-password");
    expect(p).toHaveAttribute("data-1p-ignore");
    expect(p).not.toHaveAttribute("name");
    fireEvent.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(p).toHaveAttribute("type", "text");
  });

  it("zamaskowanego hasła nie da się skopiować ani wyciąć; po Pokaż można", () => {
    vi.stubGlobal("CSS", { supports: () => true });
    const p = pole();
    expect(fireEvent.copy(p)).toBe(false);
    expect(fireEvent.cut(p)).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Pokaż hasło" }));
    expect(fireEvent.copy(p)).toBe(true);
  });
});

// Globalne podmiany (np. CSS.supports) nie przechodzą między testami
afterEach(() => {
  vi.unstubAllGlobals();
});
