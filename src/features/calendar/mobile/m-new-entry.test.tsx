import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { MNewEntry } from "./m-new-entry";

function wyrenderuj(startMin = 18 * 60) {
  const onBlock = vi.fn();
  const onClose = vi.fn();
  render(
    <MNewEntry
      date="2026-11-15"
      startMin={startMin}
      clock="24"
      onBlock={onBlock}
      onClose={onClose}
    />,
  );
  return { onBlock, onClose };
}

describe("MNewEntry", () => {
  it("arkusz „Nowy wpis” z datą i godziną, trzema wierszami i „Anuluj”, bez ✕", () => {
    wyrenderuj();
    const arkusz = screen.getByRole("dialog", { name: "Nowy wpis" });
    expect(arkusz).toHaveTextContent("nd 15.11 · 18:00");
    expect(arkusz).toHaveTextContent("czas na zadania, z kategorią");
    expect(arkusz).toHaveTextContent("dystans, czas, tempo");
    expect(arkusz).toHaveTextContent("pusty albo z szablonu");
    // ✕ z FormDialog jest ukryty na telefonie (makieta ma tylko „Anuluj”)
    expect(screen.getByRole("button", { name: "Zamknij" })).toHaveClass(
      "max-[799px]:hidden",
    );
    expect(screen.getByRole("button", { name: "Anuluj" })).toBeInTheDocument();
  });

  it("„Blok” woła onBlock, bieg i trening to linki do Sportu z datą i godziną 24 h", async () => {
    const { onBlock } = wyrenderuj(9 * 60 + 30);
    await userEvent.click(screen.getByRole("button", { name: /^Blok/ }));
    expect(onBlock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("link", { name: /^Bieg/ })).toHaveAttribute(
      "href",
      "/sport?nowy=bieg&data=2026-11-15&godzina=09:30",
    );
    expect(
      screen.getByRole("link", { name: /^Trening siłowy/ }),
    ).toHaveAttribute(
      "href",
      "/sport?nowy=silownia&data=2026-11-15&godzina=09:30",
    );
  });

  it("„Anuluj” zamyka arkusz", async () => {
    const { onClose } = wyrenderuj();
    await userEvent.click(screen.getByRole("button", { name: "Anuluj" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
