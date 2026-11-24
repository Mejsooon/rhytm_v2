import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { RenewalItem } from "./load-calendar";
import { RenewalPopover } from "./renewal-popover";

const NETFLIX: RenewalItem = {
  key: "f-ren:r1:2026-11-21",
  fieldId: "f-ren",
  pageId: "p1",
  pageTitle: "Subscriptions",
  rowId: "r1",
  date: "2026-11-21",
  next: "2026-12-21",
  title: "Netflix",
  amount: 43,
  cycle: "month",
  categoryName: "Kategoria",
  categoryLabel: "Rozrywka",
};

function kotwica() {
  const el = document.createElement("button");
  el.textContent = "Netflix · 43,00 zł";
  document.body.appendChild(el);
  return el;
}

describe("RenewalPopover", () => {
  it("pokazuje treść z makiety S2CalendarRenewal", () => {
    render(
      <RenewalPopover
        item={NETFLIX}
        anchor={kotwica()}
        today="2026-11-15"
        onClose={() => {}}
      />,
    );
    const dymek = screen.getByRole("dialog", { name: "Odnowienie Netflix" });
    expect(dymek).toHaveTextContent("Odnowienie · Subscriptions");
    expect(dymek).toHaveTextContent("sob 21.11.2026 · za 6 dni");
    expect(dymek).toHaveTextContent("Kwota43,00 zł / mies.");
    expect(dymek).toHaveTextContent("KategoriaRozrywka");
    expect(dymek).toHaveTextContent("Cyklco miesiąc");
    expect(dymek).toHaveTextContent("Następne21.12.2026");
    expect(dymek).toHaveTextContent(
      "Tylko podgląd. Edytujesz na stronie Subscriptions.",
    );
    expect(
      screen.getByRole("link", { name: "Otwórz w Subscriptions" }),
    ).toHaveAttribute("href", "/strony/p1");
  });

  it("przeszłe wystąpienie: sama data; bez kwoty i kategorii kreski; cykl roczny", () => {
    render(
      <RenewalPopover
        item={{
          ...NETFLIX,
          amount: null,
          categoryLabel: null,
          cycle: "year",
          next: "2027-11-21",
        }}
        anchor={kotwica()}
        today="2026-11-25"
        onClose={() => {}}
      />,
    );
    const dymek = screen.getByRole("dialog", { name: "Odnowienie Netflix" });
    expect(dymek).toHaveTextContent(/sob 21\.11\.2026Kwota/);
    expect(dymek).toHaveTextContent("Kwota—");
    expect(dymek).toHaveTextContent("Kategoria—");
    expect(dymek).toHaveTextContent("Cyklco rok");
  });

  it.each(["Zamknij", "Esc"])("%s zamyka dymek", async (sposob) => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(
      <RenewalPopover
        item={NETFLIX}
        anchor={kotwica()}
        today="2026-11-15"
        onClose={onClose}
      />,
    );
    expect(onClose).not.toHaveBeenCalled();
    if (sposob === "Zamknij")
      await user.click(screen.getByRole("button", { name: "Zamknij" }));
    else await user.keyboard("{Escape}");
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it("Esc oddaje fokus wpisowi odnowienia", async () => {
    const user = userEvent.setup();
    const wpis = kotwica();
    const { rerender } = render(
      <RenewalPopover item={NETFLIX} anchor={wpis} today="2026-11-15" onClose={() => {}} />,
    );
    await user.keyboard("{Escape}");
    // Rodzic po onClose odmontowuje dymek
    rerender(<></>);
    await waitFor(() => expect(wpis).toHaveFocus());
  });

  it("bez kotwicy w DOM zamyka się sam", async () => {
    const onClose = vi.fn();
    render(
      <RenewalPopover
        item={NETFLIX}
        anchor={document.createElement("button")}
        today="2026-11-15"
        onClose={onClose}
      />,
    );
    expect(screen.queryByRole("dialog")).toBeNull();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
