import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { kategoria, odnowienie, planZSzablonu, trening, wystapienie } from "./fixtures";
import { MCalendarWeek } from "./m-calendar-week";

const dni = [
  "2026-11-16",
  "2026-11-17",
  "2026-11-18",
  "2026-11-19",
  "2026-11-20",
  "2026-11-21",
  "2026-11-22",
];
const wystapienia = [
  wystapienie("b2:2026-11-18", "2026-11-18", 480, 30, "Rutyna", null),
  wystapienie("b1:2026-11-18", "2026-11-18", 600, 120, "Algebra", "c1"),
];

function wyrenderuj(
  over: Partial<React.ComponentProps<typeof MCalendarWeek>> = {},
) {
  return render(
    <MCalendarWeek
      days={dni}
      date="2026-11-18"
      today="2026-11-17"
      nowMinutes={600}
      occurrences={wystapienia}
      categories={[kategoria("c1", "Studia", "#0070f3")]}
      clock="24"
      onAdd={() => {}}
      onBlockClick={() => {}}
      {...over}
    />,
  );
}

describe("MCalendarWeek", () => {
  it("lista ma 7 dni z plakietkami, dziś: numer w czerwonym kółku", () => {
    wyrenderuj();
    expect(screen.getAllByRole("link", { name: /listopada$/ })).toHaveLength(7);
    const dzis = screen.getByRole("link", { name: "Wtorek 17 listopada" });
    expect(dzis.querySelector("[data-dzis]")).toHaveClass(
      "bg-destructive-strong",
      "size-7",
    );
    expect(dzis).toHaveAttribute(
      "href",
      "/kalendarz?widok=dzien&data=2026-11-17",
    );
  });

  it("odznaka dnia ma tło accent, a wpisy styl kategorii (tło 12, ramka 4d)", () => {
    wyrenderuj();
    const sroda = screen.getByRole("link", { name: "Środa 18 listopada" });
    expect(sroda).toHaveClass("bg-accent");
    const algebra = screen.getByRole("button", { name: /Algebra/ });
    expect(algebra.style.background).toBe("rgba(0, 112, 243, 0.07)");
    expect(algebra.style.border).toBe("1px solid rgba(0, 112, 243, 0.3)");
    expect(screen.getByRole("button", { name: "Nowy wpis" })).toHaveClass(
      "m-fab",
    );
  });

  it("dzień listuje bloki z godzinami", () => {
    wyrenderuj();
    const sekcja = screen.getByRole("region", { name: "Środa 18 listopada" });
    const bloki = within(sekcja).getAllByRole("button");
    expect(bloki[0]).toHaveTextContent("Rutyna");
    expect(bloki[0]).toHaveTextContent("08:00");
    expect(bloki[1]).toHaveTextContent("Algebra");
    expect(bloki[1]).toHaveTextContent("10:00");
  });

  it("pusty dzień mówi „Brak bloków”", () => {
    wyrenderuj();
    const sekcja = screen.getByRole("region", {
      name: "Czwartek 19 listopada",
    });
    expect(within(sekcja).getByText("Brak bloków")).toBeInTheDocument();
  });

  it("stuknięcie bloku woła onBlockClick, bez data-occurrence-key", async () => {
    const onBlockClick = vi.fn();
    const { container } = wyrenderuj({ onBlockClick });
    await userEvent.click(screen.getByRole("button", { name: /Algebra/ }));
    expect(onBlockClick).toHaveBeenCalledWith("b1:2026-11-18");
    expect(container.querySelector("[data-occurrence-key]")).toBeNull();
  });

  it("pływający „+” dodaje blok na wybrany dzień", async () => {
    const onAdd = vi.fn();
    wyrenderuj({ onAdd });
    await userEvent.click(screen.getByRole("button", { name: "Nowy wpis" }));
    expect(onAdd).toHaveBeenCalledWith("2026-11-18", 540);
  });
});

describe("MCalendarWeek — podgląd treningów", () => {
  it("dzień z samym treningiem pokazuje go zamiast „Brak bloków”", () => {
    wyrenderuj({ sport: [trening(), planZSzablonu()] });
    const wtorek = screen.getByRole("region", { name: "Wtorek 17 listopada" });
    expect(within(wtorek).queryByText("Brak bloków")).toBeNull();
    expect(
      within(wtorek).getByRole("link", { name: /Spokojny/ }),
    ).toHaveAttribute("href", "/sport?miesiac=2026-11&wybrany=s:s1");
    const czwartek = screen.getByRole("region", {
      name: "Czwartek 19 listopada",
    });
    expect(
      within(czwartek).getByRole("link", { name: /Push/ }),
    ).toHaveAttribute("data-planned", "true");
  });
});

describe("MCalendarWeek — kolejność wpisów dnia", () => {
  it("trening 09:00 stoi między blokami 08:00 i 10:00 i ma obwódkę fokusu", () => {
    wyrenderuj({ sport: [trening({ date: "2026-11-18", startMin: 540 })] });
    const sroda = screen.getByRole("region", { name: "Środa 18 listopada" });
    const tytuly = [...sroda.querySelectorAll("button, a[href^='/sport']")].map(
      (e) => e.querySelector("span")?.textContent,
    );
    expect(tytuly).toEqual(["Rutyna", "Spokojny", "Algebra"]);
    expect(within(sroda).getByRole("link", { name: /Spokojny/ })).toHaveClass(
      "focus-visible:shadow-focus",
    );
  });

  it("odnowienia są pierwszymi wpisami dnia, z przerywaną ramką, kwotą i polem dotyku 44 px", async () => {
    const onRenewalClick = vi.fn();
    wyrenderuj({
      renewals: [odnowienie({ date: "2026-11-18", key: "f-ren:r1:2026-11-18" })],
      onRenewalClick,
    });
    const dzien = screen.getByRole("region", { name: "Środa 18 listopada" });
    const wpisy = within(dzien).getAllByRole("button");
    // Odnowienie przed blokami (Rutyna 08:00, Algebra 10:00)
    expect(wpisy[0]).toHaveTextContent("↻ Netflix");
    expect(wpisy[0]).toHaveTextContent("43,00 zł");
    expect(wpisy[0]).toHaveClass("min-h-11", "border-dashed");
    expect(wpisy[1]).toHaveTextContent("Rutyna");
    await userEvent.click(wpisy[0]);
    expect(onRenewalClick).toHaveBeenCalledWith("f-ren:r1:2026-11-18");
  });

  it("dzień tylko z odnowieniem nie pokazuje „Brak bloków”", () => {
    wyrenderuj({ renewals: [odnowienie({ date: "2026-11-21" })] });
    const dzien = screen.getByRole("region", { name: "Sobota 21 listopada" });
    expect(within(dzien).getByRole("button", { name: /Netflix/ })).toBeInTheDocument();
    expect(within(dzien).queryByText("Brak bloków")).toBeNull();
  });
});
