import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { PageField } from "../fields";
import { OptionPicker } from "./option-picker";

const POLE: PageField = {
  id: "f1",
  name: "Status",
  type: "status",
  position: 1,
  isTitle: false,
  config: {
    options: [
      { id: "o1", label: "Chcę przeczytać", color: "#525252" },
      { id: "o2", label: "Czytam", color: "#0070f3" },
      { id: "o3", label: "Przeczytane", color: "#15803d" },
    ],
  },
};

function okienko(
  value: string | null = null,
  onCreate = vi.fn().mockResolvedValue("nowa"),
) {
  const propsy = {
    onPick: vi.fn(),
    onCreate,
    onUpdate: vi.fn(),
    onRemove: vi.fn(),
  };
  render(<OptionPicker field={POLE} value={value} {...propsy} />);
  return propsy;
}

describe("OptionPicker", () => {
  it("wpisanie zawęża listę", async () => {
    const user = userEvent.setup();
    okienko();
    expect(screen.getAllByRole("option")).toHaveLength(3);
    await user.type(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      "tam",
    );
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([
      "Czytam",
    ]);
  });

  it("lista ma strukturę listbox: w listbox są same opcje, a „⋯” leży poza nim", () => {
    okienko();
    const lista = screen.getByRole("listbox");
    expect(
      lista.querySelectorAll("button:not([role=option]), input"),
    ).toHaveLength(0);
    expect(screen.getAllByRole("button", { name: /^Edytuj opcję / })).toHaveLength(3);
    for (const b of screen.getAllByRole("button", { name: /^Edytuj opcję / }))
      expect(lista).not.toContainElement(b);
  });

  it("opcja select z kolorem pokazuje ten kolor, a „Bez koloru” ma obrys", () => {
    const select: PageField = {
      ...POLE,
      type: "select",
      config: {
        options: [
          { id: "a", label: "Czerwona", color: "#b91c1c" },
          { id: "b", label: "Goła", color: "" },
        ],
      },
    };
    render(
      <OptionPicker
        field={select}
        value={null}
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText("Czerwona").parentElement).toHaveStyle({
      color: "#b91c1c",
    });
    expect(screen.getByText("Czerwona").parentElement).not.toHaveClass(
      "border-input",
    );
    expect(screen.getByText("Goła").parentElement).toHaveClass("border-input");
  });

  it("fokus na opcji pokazuje jej „⋯”", () => {
    okienko();
    const przycisk = screen.getByRole("button", { name: "Edytuj opcję „Czytam”" });
    expect(przycisk).toHaveClass("opacity-0");
    act(() => screen.getByRole("option", { name: "Czytam" }).focus());
    expect(przycisk).toHaveClass("opacity-100");
  });

  it("długa nazwa opcji jest ucinana, nie wychodzi pod „⋯”", () => {
    const dluga: PageField = {
      ...POLE,
      config: {
        options: [
          {
            id: "d",
            label: "Bardzo długa nazwa opcji która nie mieści się w okienku",
            color: "#0070f3",
          },
        ],
      },
    };
    render(
      <OptionPicker
        field={dluga}
        value={null}
        onPick={vi.fn()}
        onCreate={vi.fn()}
        onUpdate={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText(/Bardzo długa/)).toHaveClass("truncate");
  });

  it("pole ma autofokus", () => {
    okienko();
    expect(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
    ).toHaveFocus();
  });

  it("„Utwórz «Porzucone»” woła onCreate, a potem onPick z nowym id", async () => {
    const user = userEvent.setup();
    const p = okienko();
    await user.type(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      "Porzucone",
    );
    // Plakietka jak w S2Books: sama nazwa, bez cudzysłowów (te zostają w nazwie dostępnej przycisku)
    const utworz = screen.getByRole("button", { name: "Utwórz «Porzucone»" });
    expect(within(utworz).getByText("Porzucone")).toBeInTheDocument();
    await user.click(utworz);
    expect(p.onCreate).toHaveBeenCalledWith("Porzucone");
    expect(p.onPick).toHaveBeenCalledWith("nowa");
  });

  it("gdy onCreate zwraca null, nic nie jest wybierane", async () => {
    const user = userEvent.setup();
    const p = okienko(null, vi.fn().mockResolvedValue(null));
    await user.type(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      "Nowa{Enter}",
    );
    expect(p.onCreate).toHaveBeenCalledWith("Nowa");
    expect(p.onPick).not.toHaveBeenCalled();
  });

  it("Enter bez dokładnego trafienia tworzy i wybiera opcję", async () => {
    const user = userEvent.setup();
    const p = okienko();
    await user.type(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      "Porzucone{Enter}",
    );
    expect(p.onCreate).toHaveBeenCalledWith("Porzucone");
    expect(p.onPick).toHaveBeenCalledWith("nowa");
  });

  it("Enter przy dokładnym trafieniu (bez względu na wielkość liter) wybiera, nie tworzy", async () => {
    const user = userEvent.setup();
    const p = okienko();
    await user.type(
      screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      "czytam{Enter}",
    );
    expect(p.onPick).toHaveBeenCalledWith("o2");
    expect(p.onCreate).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("button", { name: /^Utwórz/ }),
    ).not.toBeInTheDocument();
  });

  it("wybór bieżącej opcji ją czyści", async () => {
    const user = userEvent.setup();
    const p = okienko("o2");
    await user.click(screen.getByRole("option", { name: "Czytam" }));
    expect(p.onPick).toHaveBeenCalledWith(null);
  });

  describe("panel „Edycja opcji”", () => {
    async function panel(user: ReturnType<typeof userEvent.setup>) {
      const p = okienko();
      await user.click(screen.getByRole("button", { name: "Edytuj opcję „Czytam”" }));
      return p;
    }

    it("zmiana nazwy i Enter woła onUpdate(id, { label })", async () => {
      const user = userEvent.setup();
      const p = await panel(user);
      const nazwa = screen.getByRole("textbox", { name: "Nazwa opcji" });
      expect(nazwa).toHaveValue("Czytam");
      await user.clear(nazwa);
      await user.type(nazwa, "W trakcie{Enter}");
      expect(p.onUpdate).toHaveBeenCalledWith("o2", { label: "W trakcie" });
    });

    it("„Gotowe” zapisuje nazwę i wraca do listy", async () => {
      const user = userEvent.setup();
      const p = await panel(user);
      await user.type(
        screen.getByRole("textbox", { name: "Nazwa opcji" }),
        "!",
      );
      await user.click(screen.getByRole("button", { name: "Gotowe" }));
      expect(p.onUpdate).toHaveBeenCalledWith("o2", { label: "Czytam!" });
      expect(
        screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeInTheDocument();
    });

    it("klik „Czerwony” woła onUpdate(id, { color }), a bieżący kolor ma aria-pressed", async () => {
      const user = userEvent.setup();
      const p = await panel(user);
      expect(screen.getByRole("button", { name: "Niebieski" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await user.click(screen.getByRole("button", { name: "Czerwony" }));
      expect(p.onUpdate).toHaveBeenCalledWith("o2", { color: "#b91c1c" });
      await user.click(screen.getByRole("button", { name: "Bez koloru" }));
      expect(p.onUpdate).toHaveBeenCalledWith("o2", { color: "" });
    });

    it("„Usuń opcję” woła onRemove(id) i wraca do listy", async () => {
      const user = userEvent.setup();
      const p = await panel(user);
      await user.click(screen.getByRole("button", { name: "Usuń opcję" }));
      expect(p.onRemove).toHaveBeenCalledWith("o2");
      expect(
        screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeInTheDocument();
    });

    it("„Wstecz” wraca bez zapisu", async () => {
      const user = userEvent.setup();
      const p = await panel(user);
      await user.type(
        screen.getByRole("textbox", { name: "Nazwa opcji" }),
        "xyz",
      );
      await user.click(screen.getByRole("button", { name: "Wstecz" }));
      expect(p.onUpdate).not.toHaveBeenCalled();
      expect(
        screen.getByRole("textbox", { name: "Szukaj lub dodaj opcję" }),
      ).toBeInTheDocument();
    });
  });
});
