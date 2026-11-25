import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { kategoria, odnowienie, trening, wystapienie } from "./fixtures";
import { MCalendarDay } from "./m-calendar-day";

const kategorie = [kategoria("c1", "Studia", "#0070f3")];
// Środa 18.11.2026; tydzień pn 16.11 – nd 22.11
const wystapienia = [
  wystapienie("b1:2026-11-18", "2026-11-18", 600, 120, "Algebra", "c1"),
  wystapienie("b2:2026-11-20", "2026-11-20", 540, 60, "Siłownia", null),
];

function wyrenderuj(
  over: Partial<React.ComponentProps<typeof MCalendarDay>> = {},
) {
  return render(
    <MCalendarDay
      date="2026-11-18"
      today="2026-11-17"
      weekStart="mon"
      nowMinutes={600}
      occurrences={wystapienia}
      categories={kategorie}
      clock="24"
      onAdd={() => {}}
      onBlockClick={() => {}}
      {...over}
    />,
  );
}

describe("MCalendarDay", () => {
  it("pasek tygodnia ma kropkę tylko przy dniach z blokami", () => {
    wyrenderuj();
    expect(screen.getByTestId("kropka-2026-11-18")).toBeInTheDocument();
    expect(screen.getByTestId("kropka-2026-11-20")).toBeInTheDocument();
    expect(screen.queryByTestId("kropka-2026-11-17")).toBeNull();
    expect(screen.getAllByRole("link", { name: /listopada$/ })).toHaveLength(7);
  });

  it("dzień z paska to link do widoku dnia, wybrany ma aria-current", () => {
    wyrenderuj();
    const link = screen.getByRole("link", { name: "Piątek 20 listopada" });
    expect(link).toHaveAttribute(
      "href",
      "/kalendarz?widok=dzien&data=2026-11-20",
    );
    expect(
      screen.getByRole("link", { name: "Środa 18 listopada" }),
    ).toHaveAttribute("aria-current", "date");
  });

  it("tytuł dnia z liczbą bloków", () => {
    wyrenderuj();
    expect(screen.getByTestId("m-wiersz-daty")).toHaveTextContent(
      /^Środa, 18 listopada\s*·\s*1 blok$/,
    );
  });

  it("liczba bloków odmienia się po polsku (2–4 bloki, 12–14 i 5+ bloków, 22–24 bloki)", () => {
    // n krótkich bloków w środę, co 30 minut
    const dzien = (n: number) =>
      Array.from({ length: n }, (_, i) =>
        wystapienie(
          `x${i}:2026-11-18`,
          "2026-11-18",
          i * 30,
          15,
          `B${i}`,
          null,
        ),
      );
    const oczekiwane: [number, string][] = [
      [2, "bloki"],
      [5, "bloków"],
      [12, "bloków"],
      [14, "bloków"],
      [22, "bloki"],
      [24, "bloki"],
      [25, "bloków"],
    ];
    for (const [n, slowo] of oczekiwane) {
      const { unmount } = wyrenderuj({ occurrences: dzien(n) });
      expect(screen.getByTestId("m-wiersz-daty")).toHaveTextContent(
        new RegExp(`^Środa, 18 listopada\\s*·\\s*${n} ${slowo}$`),
      );
      unmount();
    }
  });

  it("pasek pod datą: zaplanowane, wolne (8–20) i zadania z danych dnia", () => {
    const zadanie = (id: string, done: boolean) => ({
      id,
      user_id: "u1",
      title: id,
      done,
      done_at: null,
      due_date: "2026-11-18",
      block_id: "b1",
      occurrence_date: "2026-11-18",
      position: 1,
      created_at: null,
    });
    wyrenderuj({
      // Algebra 10:00–12:00 (2 h) i blok 07:00–08:30, z czego do okna 8–20 wchodzi 30 min
      occurrences: [
        ...wystapienia,
        wystapienie("b3:2026-11-18", "2026-11-18", 420, 90, "Rano", null),
      ],
      tasks: [zadanie("z1", true), zadanie("z2", false), zadanie("z3", false)],
    });
    expect(screen.getByTestId("m-pasek-dnia")).toHaveTextContent(
      "Zaplanowane 3 h 30 min · wolne (8–20) 9 h 30 min · zadania 1/3",
    );
  });

  it("pasek pod datą: pusty dzień to 0 h, wolne 12 h, zadania 0/0", () => {
    wyrenderuj({ occurrences: [] });
    expect(screen.getByTestId("m-pasek-dnia")).toHaveTextContent(
      "Zaplanowane 0 h · wolne (8–20) 12 h · zadania 0/0",
    );
  });

  it("blok pokazuje godziny i kategorię, bez data-occurrence-key", () => {
    const { container } = wyrenderuj();
    expect(screen.getByRole("button", { name: /Algebra/ })).toHaveTextContent(
      "10:00–12:00 · Studia",
    );
    expect(container.querySelector("[data-occurrence-key]")).toBeNull();
  });

  it("blok krótszy niż godzina: tytuł i godziny w jednej linii, wyśrodkowane, tytuł z wielokropkiem", () => {
    wyrenderuj({
      occurrences: [
        wystapienie(
          "k1:2026-11-18",
          "2026-11-18",
          480,
          45,
          "Bardzo długi tytuł porannej rutyny",
          "c1",
        ),
        wystapienie("k2:2026-11-18", "2026-11-18", 600, 60, "Godzina", "c1"),
      ],
    });
    const krotki = screen.getByRole("button", { name: /Bardzo długi/ });
    const linia = within(krotki).getByTestId("blok-jedna-linia");
    expect(linia.className).toContain("items-center");
    expect(linia.className).not.toContain("flex-col");
    const [tytul, godziny] = Array.from(linia.children) as HTMLElement[];
    expect(tytul).toHaveTextContent("Bardzo długi tytuł porannej rutyny");
    expect(tytul.className).toContain("truncate");
    expect(tytul.className).toContain("whitespace-nowrap");
    // Krótki blok pokazuje same godziny (bez kategorii), które się nie ucinają
    expect(godziny).toHaveTextContent(/^08:00–08:45$/);
    expect(godziny.className).toContain("flex-none");
    // Pełna godzina ma już dwie linie z kategorią
    const godzinny = screen.getByRole("button", { name: /Godzina/ });
    expect(within(godzinny).queryByTestId("blok-jedna-linia")).toBeNull();
    expect(godzinny).toHaveTextContent("10:00–11:00 · Studia");
  });

  it("oś wypełnia resztę ekranu przez flex, bez sztywnej wysokości", () => {
    wyrenderuj();
    const os = screen.getByTestId("m-os-dnia");
    expect(os.className).toContain("flex-1");
    expect(os.className).toContain("min-h-0");
    expect(os.className).toContain("overflow-y-auto");
    expect(os.className).not.toMatch(/100dvh|440px/);
  });

  it("blok stoi na 56 px na godzinę", () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /Algebra/ });
    expect(blok.style.top).toBe(`${10 * 56 + 1}px`);
    expect(blok.style.height).toBe(`${2 * 56 - 4}px`);
  });

  it("stuknięcie bloku woła onBlockClick z kluczem", async () => {
    const onBlockClick = vi.fn();
    wyrenderuj({ onBlockClick });
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(onBlockClick).toHaveBeenCalledWith("b1:2026-11-18");
  });

  it("stuknięcie pustej osi o 10:00 woła onAdd z tą godziną", () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    fireEvent.click(
      screen.getByRole("button", { name: "Dodaj wpis w wolnym miejscu" }),
      { clientY: 10 * 56 },
    );
    expect(onAdd).toHaveBeenCalledWith("2026-11-18", 600);
  });

  it("pływający „+” dodaje blok na dzień", async () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "Nowy wpis" }));
    expect(onAdd).toHaveBeenCalledWith("2026-11-18", 540);
  });

  it("linia „teraz” tylko w dzisiejszym dniu", () => {
    const { unmount } = wyrenderuj({ date: "2026-11-17", today: "2026-11-17" });
    expect(screen.getByTestId("linia-teraz").style.top).toBe(
      `${(600 / 60) * 56}px`,
    );
    unmount();
    wyrenderuj();
    expect(screen.queryByTestId("linia-teraz")).toBeNull();
  });

  it("linia „teraz” ma kolor tokenu destructive i kropkę 10 px", () => {
    wyrenderuj({ date: "2026-11-17", today: "2026-11-17" });
    const linia = screen.getByTestId("linia-teraz");
    expect(linia.className).toContain("bg-destructive");
    expect(linia.className).not.toContain("bg-destructive-");
    const kropka = linia.firstElementChild as HTMLElement;
    expect(kropka.className).toContain("size-2.5");
    expect(kropka.className).toContain("bg-destructive");
  });

  it("dziś niewybrane ma czerwone kółko, wybrany dzień to ciemny kafelek bez kółka", () => {
    const { unmount } = wyrenderuj({ date: "2026-11-18", today: "2026-11-17" });
    const dzis = screen.getByRole("link", { name: "Wtorek 17 listopada" });
    expect(dzis.querySelector("[data-dzis]")!.className).toContain(
      "bg-destructive-strong",
    );
    const wybrany = screen.getByRole("link", { name: "Środa 18 listopada" });
    expect(wybrany.className).toContain("bg-primary");
    unmount();
    wyrenderuj({ date: "2026-11-17", today: "2026-11-17" });
    const dzisWybrany = screen.getByRole("link", {
      name: "Wtorek 17 listopada",
    });
    expect(dzisWybrany.className).toContain("bg-primary");
    expect(dzisWybrany.querySelector("[data-dzis]")!.className).not.toContain(
      "bg-destructive-strong",
    );
  });

  it("blok ma tło kategorii 12 i ramkę 4d, a „+” to m-fab", () => {
    wyrenderuj();
    const blok = screen.getByRole("button", { name: /Algebra/ });
    expect(blok.style.background).toBe("rgba(0, 112, 243, 0.07)");
    expect(blok.style.border).toBe("1px solid rgba(0, 112, 243, 0.3)");
    expect(screen.getByRole("button", { name: "Nowy wpis" })).toHaveClass(
      "m-fab",
    );
  });

  it("oś startuje przewinięta do 07:00", () => {
    wyrenderuj();
    expect(screen.getByTestId("m-os-dnia").scrollTop).toBe(7 * 56);
  });

  it("w dzisiejszym dniu oś przewija do trwającego bloku", () => {
    wyrenderuj({
      date: "2026-11-18",
      today: "2026-11-18",
      nowMinutes: 630,
      occurrences: [
        wystapienia[0],
        wystapienie("b3:2026-11-18", "2026-11-18", 960, 60, "Bieg", null),
      ],
    });
    expect(screen.getByTestId("m-os-dnia").scrollTop).toBe(
      Math.round((600 / 60) * 56 - 28),
    );
  });

  it("niski blok (30 min) ma pole dotyku co najmniej 44 px", () => {
    wyrenderuj({
      occurrences: [
        wystapienie("b9:2026-11-18", "2026-11-18", 480, 30, "Rutyna", null),
      ],
    });
    const blok = screen.getByRole("button", { name: /Rutyna/ });
    const wysokosc = parseFloat(blok.style.height);
    const obszar = screen.getByTestId("obszar-dotyku");
    const zapas = -parseFloat(obszar.style.top);
    expect(blok).toContainElement(obszar);
    expect(wysokosc + 2 * zapas).toBeGreaterThanOrEqual(44);
  });

  it("wysoki blok nie dostaje dodatkowego obszaru dotyku", () => {
    wyrenderuj();
    expect(screen.queryByTestId("obszar-dotyku")).toBeNull();
  });
});

describe("MCalendarDay — podgląd treningów", () => {
  it("trening dnia to link do /sport, plan przerywany; dzień z treningiem ma kropkę", () => {
    wyrenderuj({
      sport: [
        trening({ date: "2026-11-18" }),
        trening({
          key: "t:t1:2026-11-18",
          date: "2026-11-18",
          startMin: 1110,
          durationMin: 90,
          title: "Push",
          planned: true,
        }),
        trening({ key: "s:s9", date: "2026-11-21" }),
      ],
    });
    const bieg = screen.getByRole("link", { name: /Spokojny/ });
    expect(bieg).toHaveAttribute("href", "/sport?miesiac=2026-11&wybrany=s:s1");
    expect(bieg.style.borderLeft).toBe("3px solid rgb(194, 65, 12)");
    const plan = screen.getByRole("link", { name: /Push/ });
    expect(plan).toHaveAttribute("data-planned", "true");
    expect(plan).toHaveTextContent("18:30–20:00 · Sport");
    expect(screen.getByTestId("kropka-2026-11-21")).toBeInTheDocument();
    // Fokus z klawiatury widoczny jak na webie
    expect(bieg).toHaveClass("focus-visible:shadow-focus");
  });

  it("odnowienia dnia: plakietki w pasku nad osią, przerywana ramka, pole dotyku 44 px, stuknięcie woła onRenewalClick", async () => {
    const onRenewalClick = vi.fn();
    wyrenderuj({
      date: "2026-11-21",
      renewals: [
        odnowienie(),
        odnowienie({ key: "f-ren:r2:2026-11-21", title: "Spotify", amount: 23.99 }),
        odnowienie({ key: "f-ren:r3:2026-11-22", title: "Inne", date: "2026-11-22" }),
      ],
      onRenewalClick,
    });
    const pasek = screen.getByTestId("m-pasek-dnia");
    const netflix = within(pasek).getByRole("button", { name: "↻ Netflix · 43,00 zł" });
    expect(within(pasek).getByRole("button", { name: "↻ Spotify · 23,99 zł" })).toBeInTheDocument();
    // Odnowienie z innego dnia nie trafia do paska
    expect(within(pasek).queryByRole("button", { name: /Inne/ })).toBeNull();
    // Plakietka: szara (sec) z przerywaną ramką; przycisk ma pole dotyku 44 px (m-hit: ±14 px wokół 18 px)
    expect(netflix).toHaveClass("m-hit");
    expect(netflix.firstElementChild).toHaveClass("border-dashed", "bg-muted");
    await userEvent.click(netflix);
    expect(onRenewalClick).toHaveBeenCalledWith("f-ren:r1:2026-11-21");
  });

  it("odnowienie bez kwoty pokazuje samą nazwę, a dzień bez odnowień nie ma plakietek", () => {
    wyrenderuj({ date: "2026-11-21", renewals: [odnowienie({ amount: null })] });
    expect(within(screen.getByTestId("m-pasek-dnia")).getByRole("button", { name: "↻ Netflix" })).toBeInTheDocument();
  });

  it("bez odnowień pasek ma tylko tekst „dnia w liczbach”", () => {
    wyrenderuj();
    expect(within(screen.getByTestId("m-pasek-dnia")).queryAllByRole("button")).toHaveLength(0);
  });
});
