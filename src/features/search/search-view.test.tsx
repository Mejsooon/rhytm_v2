import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { searchAll, back, push, toastError } = vi.hoisted(() => ({
  searchAll: vi.fn(),
  back: vi.fn(),
  push: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock("./actions", () => ({ searchAll }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ back, push }) }));
vi.mock("sonner", () => ({ toast: { error: toastError } }));

import { SearchView } from "./search-view";

const KLUCZ = "rhytm_szukaj_ostatnio";

function trafienie(title: string) {
  return {
    ok: true,
    groups: [
      { title: "Kalendarz", items: [{ title, meta: "dziś 10:30–12:30", href: "/kalendarz?widok=dzien&data=2026-11-26" }] },
    ],
  };
}

// Wpisanie frazy i odczekanie debounce'u (250 ms) wraz z rozwiązaniem obietnic
async function wpisz(fraza: string, ms = 250) {
  fireEvent.change(screen.getByRole("searchbox", { name: "Szukaj" }), { target: { value: fraza } });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
});
afterEach(() => {
  vi.useRealTimers();
  delete (window as { matchMedia?: unknown }).matchMedia;
});

describe("SearchView", () => {
  it("pusta fraza: szybkie akcje z poprawnymi adresami, bez „Ostatnio”", () => {
    render(<SearchView />);
    expect(screen.getByRole("link", { name: "Nowe zadanie lub blok" })).toHaveAttribute("href", "/dzis?szybko=blok");
    expect(screen.getByRole("link", { name: "Zapisz bieg" })).toHaveAttribute("href", "/sport?nowy=bieg");
    expect(screen.getByRole("link", { name: "Wpis snu" })).toHaveAttribute("href", "/nawyki?nowy=sen");
    expect(screen.getByRole("link", { name: "Nowa strona" })).toHaveAttribute("href", "/strony/nowa");
    expect(screen.queryByText("Ostatnio")).not.toBeInTheDocument();
  });

  it("debounce: zapytanie dopiero po 250 ms ciszy i tylko dla ostatniej frazy", async () => {
    searchAll.mockResolvedValue(trafienie("Matematyka"));
    render(<SearchView />);
    await wpisz("ma", 100);
    await wpisz("mat", 249);
    expect(searchAll).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(searchAll).toHaveBeenCalledTimes(1);
    expect(searchAll).toHaveBeenCalledWith("mat");
    expect(screen.getByText("Kalendarz")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /Matematyka/ });
    expect(link).toHaveAttribute("href", "/kalendarz?widok=dzien&data=2026-11-26");
    expect(link).toHaveTextContent("dziś 10:30–12:30");
  });

  it("fraza krótsza niż 2 znaki nie wywołuje wyszukiwania", async () => {
    render(<SearchView />);
    await wpisz("m", 500);
    expect(searchAll).not.toHaveBeenCalled();
    expect(screen.getByText("Szybkie akcje")).toBeInTheDocument();
  });

  it("odrzuca spóźnioną odpowiedź na starą frazę", async () => {
    const odpowiedzi: Array<(v: unknown) => void> = [];
    searchAll.mockImplementation(() => new Promise((resolve) => odpowiedzi.push(resolve)));
    render(<SearchView />);
    await wpisz("mat");
    await wpisz("matem");
    expect(searchAll).toHaveBeenCalledTimes(2);
    // Najpierw odpowiada nowsze, potem starsze zapytanie
    await act(async () => {
      odpowiedzi[1](trafienie("Matematyka"));
      odpowiedzi[0](trafienie("Mat. stara"));
    });
    expect(screen.getByRole("link", { name: /Matematyka/ })).toBeInTheDocument();
    expect(screen.queryByText("Mat. stara")).not.toBeInTheDocument();
  });

  it("wyczyszczenie pola odrzuca odpowiedź w drodze i wraca do szybkich akcji", async () => {
    let odpowiedz: (v: unknown) => void = () => {};
    searchAll.mockImplementation(() => new Promise((resolve) => (odpowiedz = resolve)));
    render(<SearchView />);
    await wpisz("mat");
    await wpisz("");
    await act(async () => {
      odpowiedz(trafienie("Matematyka"));
    });
    expect(screen.queryByText("Matematyka")).not.toBeInTheDocument();
    expect(screen.getByText("Szybkie akcje")).toBeInTheDocument();
  });

  it("brak wyników: pusty stan z frazą", async () => {
    searchAll.mockResolvedValue({ ok: true, groups: [] });
    render(<SearchView />);
    await wpisz("xyz");
    expect(screen.getByText("Nic nie znaleziono dla „xyz”")).toBeInTheDocument();
    expect(screen.queryByText("Szybkie akcje")).not.toBeInTheDocument();
    // Fraza bez trafień nie trafia do „Ostatnio”
    expect(localStorage.getItem(KLUCZ)).toBeNull();
  });

  it("„Ostatnio” z localStorage; stuknięcie wpisuje frazę", async () => {
    localStorage.setItem(KLUCZ, JSON.stringify(["bazy", "bieg"]));
    searchAll.mockResolvedValue(trafienie("Bazy danych"));
    render(<SearchView />);
    expect(screen.getByText("Ostatnio")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "bazy" }));
    expect(screen.getByRole("searchbox", { name: "Szukaj" })).toHaveValue("bazy");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });
    expect(searchAll).toHaveBeenCalledWith("bazy");
  });

  it("zapisuje frazę z trafieniem na początku listy, bez duplikatów i max 5", async () => {
    localStorage.setItem(KLUCZ, JSON.stringify(["a1", "a2", "BAZY", "a4", "a5"]));
    searchAll.mockResolvedValue(trafienie("Bazy danych"));
    render(<SearchView />);
    await wpisz("bazy");
    expect(JSON.parse(localStorage.getItem(KLUCZ)!)).toEqual(["bazy", "a1", "a2", "a4", "a5"]);
  });

  it("uszkodzony zapis „Ostatnio” jest ignorowany", () => {
    localStorage.setItem(KLUCZ, "{nie json");
    render(<SearchView />);
    expect(screen.queryByText("Ostatnio")).not.toBeInTheDocument();
    expect(screen.getByText("Szybkie akcje")).toBeInTheDocument();
  });

  it("błąd wyszukiwania: toast", async () => {
    searchAll.mockResolvedValue({ ok: false, message: "x" });
    render(<SearchView />);
    await wpisz("mat");
    expect(toastError).toHaveBeenCalledWith("Nie udało się wyszukać");
  });

  it("wyjątek akcji też kończy się toastem", async () => {
    searchAll.mockRejectedValue(new Error("sieć"));
    render(<SearchView />);
    await wpisz("mat");
    expect(toastError).toHaveBeenCalledWith("Nie udało się wyszukać");
  });

  it("„Anuluj” z historią cofa, bez historii prowadzi na Dziś", () => {
    render(<SearchView />);
    Object.defineProperty(window.history, "length", { value: 3, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(back).toHaveBeenCalledTimes(1);
    Object.defineProperty(window.history, "length", { value: 1, configurable: true });
    fireEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(push).toHaveBeenCalledWith("/dzis");
  });

  it("pole dostaje fokus tylko na telefonie", () => {
    window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
    const { unmount } = render(<SearchView />);
    expect(screen.getByRole("searchbox", { name: "Szukaj" })).not.toHaveFocus();
    unmount();
    window.matchMedia = vi.fn().mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    render(<SearchView />);
    expect(screen.getByRole("searchbox", { name: "Szukaj" })).toHaveFocus();
  });
});
