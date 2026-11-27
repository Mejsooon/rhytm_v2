import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { searchAll, push } = vi.hoisted(() => ({ searchAll: vi.fn(), push: vi.fn() }));
vi.mock("./actions", () => ({ searchAll }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), usePathname: () => "/dzis" }));

import { CommandMenu } from "./command-menu";

const pole = () => screen.getByRole("combobox", { name: "Szukaj" });
const wybrana = () => screen.getByRole("option", { selected: true });
const klawisz = (key: string) => fireEvent.keyDown(pole(), { key });
const czekaj = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(250);
  });

function otworz() {
  render(<CommandMenu />);
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  localStorage.clear();
  sessionStorage.clear();
  searchAll.mockResolvedValue({
    ok: true,
    groups: [{ title: "Strony", items: [{ title: "Subskrypcje", meta: "13 wierszy", href: "/strony/s1" }] }],
  });
});
afterEach(() => vi.useRealTimers());

describe("CommandMenu", () => {
  it("Ctrl+K otwiera okno z akcjami; strzałki i Enter otwierają akcję", () => {
    otworz();
    expect(wybrana()).toHaveTextContent("Szybko dodaj…");
    klawisz("ArrowDown");
    expect(wybrana()).toHaveTextContent("Nowy blok");
    klawisz("Enter");
    expect(push).toHaveBeenCalledWith("/dzis?szybko=blok");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("Enter przed odpowiedzią serwera nic nie otwiera; potem otwiera wynik i zapamiętuje go", async () => {
    otworz();
    fireEvent.change(pole(), { target: { value: "sub" } });
    klawisz("Enter");
    expect(push).not.toHaveBeenCalled();
    await czekaj();
    expect(wybrana()).toHaveTextContent("Subskrypcje");
    klawisz("Enter");
    expect(push).toHaveBeenCalledWith("/strony/s1");

    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(screen.getByText("Ostatnio")).toBeInTheDocument();
    expect(wybrana()).toHaveTextContent("Subskrypcje");
  });

  it("bez trafień: „Brak wyników” i „Szybko dodaj” z wpisanym tekstem", async () => {
    searchAll.mockResolvedValue({ ok: true, groups: [] });
    otworz();
    fireEvent.change(pole(), { target: { value: "bieg 10 km" } });
    await czekaj();
    expect(screen.getByText("Brak wyników")).toBeInTheDocument();
    klawisz("Enter");
    expect(push).toHaveBeenCalledWith("/dzis?szybko=dodaj");
    expect(sessionStorage.getItem("rhytm_szybko")).toBe("bieg 10 km");
  });
});
