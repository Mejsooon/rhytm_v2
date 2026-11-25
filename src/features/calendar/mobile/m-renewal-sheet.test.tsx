import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { odnowienie } from "./fixtures";
import { MRenewalSheet } from "./m-renewal-sheet";

describe("MRenewalSheet (CMRenewalSheet)", () => {
  it("pokazuje plakietkę, nazwę, kwotę i wiersze Cykl / Ten termin / Następne / Kategoria", () => {
    render(
      <MRenewalSheet
        item={odnowienie({ date: "2026-11-14", next: "2026-12-14" })}
        today="2026-11-15"
        onClose={() => {}}
      />,
    );
    const arkusz = screen.getByRole("dialog", { name: "Odnowienie Netflix" });
    expect(within(arkusz).getByText("↻ Odnowienie · Subscriptions")).toBeInTheDocument();
    expect(within(arkusz).getByRole("heading", { name: "Netflix", level: 2 })).toBeInTheDocument();
    expect(within(arkusz).getByText("43,00 zł / mies.")).toBeInTheDocument();
    expect(arkusz).toHaveTextContent("Cykl" + "co miesiąc");
    expect(arkusz).toHaveTextContent("Ten termin" + "sob 14.11.2026");
    expect(arkusz).toHaveTextContent("Następne" + "pon 14.12.2026 · za 29 dni");
    expect(arkusz).toHaveTextContent("Kategoria" + "Rozrywka");
    expect(within(arkusz).getByText("Tylko podgląd. Edytujesz na stronie Subscriptions.")).toBeInTheDocument();
  });

  it("przycisk „Otwórz w <strona>” prowadzi do /strony/<id> na całą szerokość", () => {
    render(<MRenewalSheet item={odnowienie()} today="2026-11-15" onClose={() => {}} />);
    const link = screen.getByRole("link", { name: "Otwórz w Subscriptions" });
    expect(link).toHaveAttribute("href", "/strony/p1");
    expect(link).toHaveClass("w-full");
  });

  it("roczny cykl bez kwoty i bez kategorii: „co rok”, „—”", () => {
    render(
      <MRenewalSheet
        item={odnowienie({ cycle: "year", amount: null, categoryLabel: null, categoryName: "Typ" })}
        today="2026-11-15"
        onClose={() => {}}
      />,
    );
    const arkusz = screen.getByRole("dialog");
    expect(arkusz).toHaveTextContent("co rok");
    expect(arkusz).toHaveTextContent("Typ" + "—");
    expect(within(arkusz).queryByText(/zł \//)).toBeNull();
  });

  it("✕ zamyka arkusz", async () => {
    const onClose = vi.fn();
    render(<MRenewalSheet item={odnowienie()} today="2026-11-15" onClose={onClose} />);
    await userEvent.click(screen.getByRole("button", { name: "Zamknij" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("przeszłe „Następne” (przegląd poprzedniego miesiąca) pokazuje samą datę, bez „minął”", () => {
    render(
      <MRenewalSheet
        item={odnowienie({ date: "2026-10-14", next: "2026-11-14" })}
        today="2026-11-25"
        onClose={() => {}}
      />,
    );
    const arkusz = screen.getByRole("dialog");
    expect(arkusz).toHaveTextContent("Następne" + "sob 14.11.2026");
    expect(arkusz).not.toHaveTextContent("minął");
    expect(arkusz).not.toHaveTextContent("za ");
  });
});
