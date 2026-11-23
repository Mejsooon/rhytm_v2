import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));

import type { PageField } from "../fields";
import type { PinnedCard } from "../table-model";
import { PinnedCards } from "./pinned-cards";

const POLA: PageField[] = [
  {
    id: "f-autor",
    name: "Autor",
    type: "text",
    config: {},
    position: 0,
    isTitle: false,
  },
];
const A: PinnedCard = {
  label: "Autorzy",
  field_id: "f-autor",
  aggregation: "count_distinct",
};
const B: PinnedCard = {
  label: "Autorzy B",
  field_id: "f-autor",
  aggregation: "count_distinct",
  width: 300,
};
const C: PinnedCard = {
  label: "Autorzy C",
  field_id: "f-autor",
  aggregation: "count_distinct",
};

function pokaz(cards: PinnedCard[]) {
  const onChange = vi.fn();
  const onAdd = vi.fn();
  const onEdit = vi.fn();
  const wynik = render(
    <PinnedCards
      cards={cards}
      fields={POLA}
      rows={[]}
      today="2026-11-15"
      onChange={onChange}
      onAdd={onAdd}
      onEdit={onEdit}
    />,
  );
  return { onChange, onAdd, onEdit, ...wynik };
}

function uchwyt(etykieta: string) {
  return screen.getByRole("separator", {
    name: `Zmień szerokość karty „${etykieta}” (strzałki w lewo i w prawo)`,
  });
}

async function otworzMenu(
  user: ReturnType<typeof userEvent.setup>,
  indeks: number,
) {
  await user.click(
    screen.getAllByRole("button", { name: "Menu karty" })[indeks],
  );
  return screen.getByRole("menu", { name: "Menu karty" });
}

describe("PinnedCards: szerokość, menu i kolejność", () => {
  beforeEach(() => {
    toast.mockClear();
  });

  it("karta bez width ma 220 px, min. 180 px i max-width 100%; zapisane width jest użyte", () => {
    pokaz([A, B]);
    const [karta, drugaKarta] = screen.getAllByTestId("karta");
    expect(karta).toHaveStyle({
      width: "220px",
      minWidth: "180px",
      maxWidth: "100%",
    });
    expect(drugaKarta).toHaveStyle({ width: "300px" });
  });

  it("śmieciowe width z bazy (poniżej 180, NaN) daje domyślne 220", () => {
    pokaz([
      { ...A, width: 50 },
      { ...B, width: Number.NaN },
    ]);
    const karty = screen.getAllByTestId("karta");
    expect(karty[0]).toHaveStyle({ width: "220px" });
    expect(karty[1]).toHaveStyle({ width: "220px" });
  });

  it("ArrowRight na uchwycie zapisuje width 240 tylko w tej karcie; ArrowLeft nie schodzi poniżej 180", async () => {
    const user = userEvent.setup();
    const { onChange } = pokaz([A, { ...C, width: 180 }]);
    uchwyt("Autorzy").focus();
    await user.keyboard("{ArrowRight}");
    expect(onChange).toHaveBeenCalledWith([
      { ...A, width: 240 },
      { ...C, width: 180 },
    ]);

    onChange.mockClear();
    uchwyt("Autorzy C").focus();
    await user.keyboard("{ArrowLeft}");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("przeciąganie zapisuje raz po puszczeniu, z zaokrągleniem i min. 180", () => {
    const { onChange } = pokaz([A]);
    const u = uchwyt("Autorzy");
    u.setPointerCapture = vi.fn();
    u.releasePointerCapture = vi.fn();
    fireEvent.pointerDown(u, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 1, clientX: 140.4 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("karta")).toHaveStyle({ width: "260px" });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 1, clientX: -500 });
    expect(screen.getByTestId("karta")).toHaveStyle({ width: "180px" });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 1, clientX: 140.4 });
    fireEvent.pointerUp(u, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith([{ ...A, width: 260 }]);
  });

  it("ruch bez wciśniętego przycisku kończy przeciąganie bez zapisu", () => {
    const { onChange } = pokaz([A]);
    const u = uchwyt("Autorzy");
    u.setPointerCapture = vi.fn();
    fireEvent.pointerDown(u, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 1, clientX: 160 });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 0, clientX: 200 });
    fireEvent.pointerUp(u, { pointerId: 1 });
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId("karta")).toHaveStyle({ width: "220px" });
  });

  it("utrata capture kończy przeciąganie zapisem, gdy była zmiana", () => {
    const { onChange } = pokaz([A]);
    const u = uchwyt("Autorzy");
    u.setPointerCapture = vi.fn();
    fireEvent.pointerDown(u, { button: 0, pointerId: 1, clientX: 100 });
    fireEvent.pointerMove(u, { pointerId: 1, buttons: 1, clientX: 120 });
    fireEvent.lostPointerCapture(u, { pointerId: 1 });
    expect(onChange).toHaveBeenCalledWith([{ ...A, width: 240 }]);
  });

  it("menu ma pozycje z S2CardMenu; „Przesuń w prawo” zamienia kolejność", async () => {
    const user = userEvent.setup();
    const { onChange } = pokaz([A, B]);
    const menu = await otworzMenu(user, 0);
    for (const nazwa of [
      "Edytuj kartę",
      "Przesuń w lewo",
      "Przesuń w prawo",
      "Domyślna szerokość",
      "Usuń kartę",
    ]) {
      expect(screen.getByRole("menuitem", { name: nazwa })).toBeInTheDocument();
    }
    expect(menu).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Przesuń w prawo" }));
    expect(onChange).toHaveBeenCalledWith([B, A]);
  });

  it("przesuwanie jest wyłączone na krańcach", async () => {
    const user = userEvent.setup();
    pokaz([A, B]);
    await otworzMenu(user, 0);
    expect(
      screen.getByRole("menuitem", { name: "Przesuń w lewo" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Przesuń w prawo" }),
    ).toBeEnabled();
    await user.keyboard("{Escape}");
    await otworzMenu(user, 1);
    expect(
      screen.getByRole("menuitem", { name: "Przesuń w prawo" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("menuitem", { name: "Przesuń w lewo" }),
    ).toBeEnabled();
  });

  it("„Domyślna szerokość” usuwa width i jest wyłączona bez width", async () => {
    const user = userEvent.setup();
    const { onChange } = pokaz([A, B]);
    await otworzMenu(user, 0);
    expect(
      screen.getByRole("menuitem", { name: "Domyślna szerokość" }),
    ).toBeDisabled();
    await user.keyboard("{Escape}");
    await otworzMenu(user, 1);
    await user.click(
      screen.getByRole("menuitem", { name: "Domyślna szerokość" }),
    );
    expect(onChange).toHaveBeenCalledTimes(1);
    const [lista] = onChange.mock.calls[0] as [PinnedCard[]];
    expect(lista[0]).toEqual(A);
    expect("width" in lista[1]).toBe(false);
  });

  it("„Edytuj kartę” wywołuje onEdit z indeksem", async () => {
    const user = userEvent.setup();
    const { onEdit } = pokaz([A, B]);
    await otworzMenu(user, 1);
    await user.click(screen.getByRole("menuitem", { name: "Edytuj kartę" }));
    expect(onEdit).toHaveBeenCalledWith(1);
  });

  it("„Usuń kartę” usuwa od razu z toastem, a „Cofnij” przywraca listę", async () => {
    const user = userEvent.setup();
    const { onChange, rerender } = pokaz([A, B, C]);
    await otworzMenu(user, 1);
    await user.click(screen.getByRole("menuitem", { name: "Usuń kartę" }));
    expect(onChange).toHaveBeenCalledWith([A, C]);
    expect(toast).toHaveBeenCalledWith(
      "Usunięto",
      expect.objectContaining({
        action: expect.objectContaining({ label: "Cofnij" }),
      }),
    );

    // Rodzic zapisał krótszą listę; „Cofnij” wstawia kartę na dawne miejsce
    rerender(
      <PinnedCards
        cards={[A, C]}
        fields={POLA}
        rows={[]}
        today="2026-11-15"
        onChange={onChange}
        onAdd={vi.fn()}
        onEdit={vi.fn()}
      />,
    );
    onChange.mockClear();
    const { action } = toast.mock.calls[0][1] as {
      action: { onClick: () => void };
    };
    action.onClick();
    expect(onChange).toHaveBeenCalledWith([A, B, C]);
  });

  it("przy 0 kart jest przycisk „Dodaj kartę”, który wywołuje onAdd", async () => {
    const user = userEvent.setup();
    const { onAdd } = pokaz([]);
    await user.click(screen.getByRole("button", { name: "Dodaj kartę" }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it("bez onAdd nie ma przycisku „Dodaj kartę”, a bez onEdit nie ma pozycji „Edytuj kartę”", async () => {
    const user = userEvent.setup();
    render(
      <PinnedCards
        cards={[A]}
        fields={POLA}
        rows={[]}
        today="2026-11-15"
        onChange={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Dodaj kartę" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Menu karty" }));
    expect(screen.queryByRole("menuitem", { name: "Edytuj kartę" })).toBeNull();
    expect(
      screen.getByRole("menuitem", { name: "Przesuń w lewo" }),
    ).toBeTruthy();
  });
});
