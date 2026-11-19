import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/strony/b";
const { push, toast, reorderPages, deletePage, restorePage, setPageIcon, setFavorite, duplicatePage } =
  vi.hoisted(() => ({
    push: vi.fn(),
    toast: Object.assign(vi.fn(), { error: vi.fn() }),
    reorderPages: vi.fn(),
    deletePage: vi.fn(),
    restorePage: vi.fn(),
    setPageIcon: vi.fn(),
    setFavorite: vi.fn(),
    duplicatePage: vi.fn(),
  }));
vi.mock("next/navigation", () => ({
  usePathname: () => sciezka,
  useRouter: () => ({ push, back: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("./actions", () => ({
  reorderPages,
  deletePage,
  restorePage,
  setPageIcon,
  setFavorite,
  duplicatePage,
  renamePage: vi.fn(),
}));

import { ICONS } from "./icon-grid";
import type { PageSummary } from "./load-pages";
import { PageMenu } from "./page-menu";
import { usePagesStore } from "./use-pages-store";

function strona(id: string, title: string, reszta: Partial<PageSummary> = {}): PageSummary {
  return { id, title, icon: "▤", favorite: false, templateKey: "books", position: 0, rowCount: 11, ...reszta };
}

const POCZATKOWE = [strona("a", "Alfa"), strona("b", "Books"), strona("c", "Gamma")];

// Menu strony „Books” z prawdziwym magazynem (optymistyczne zmiany widać w `pages`)
function Uprzaz({ onRename = vi.fn() }: { onRename?: () => void }) {
  const store = usePagesStore(POCZATKOWE);
  const books = store.pages.find((p) => p.id === "b");
  return (
    <>
      <output data-testid="kolejnosc">{store.pages.map((p) => p.id).join(",")}</output>
      <output data-testid="ikona">{books?.icon}</output>
      {books && <PageMenu page={books} pages={store.pages} store={store} onRename={onRename} />}
    </>
  );
}

async function otworz() {
  const user = userEvent.setup();
  render(<Uprzaz />);
  await user.click(screen.getByRole("button", { name: "Menu strony Books" }));
  return user;
}

describe("PageMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sciezka = "/strony/b";
    reorderPages.mockResolvedValue({ ok: true });
    deletePage.mockResolvedValue({ ok: true });
    restorePage.mockResolvedValue({ ok: true });
    setPageIcon.mockResolvedValue({ ok: true });
    setFavorite.mockResolvedValue({ ok: true });
    duplicatePage.mockResolvedValue({ ok: true, id: "kopia" });
  });

  it("pokazuje pozycje z makiety i „★ Dodaj do ulubionych”", async () => {
    await otworz();
    const menu = screen.getByRole("menu", { name: "Strona Books" });
    for (const nazwa of ["Zmień nazwę", "Zmień ikonę", "Duplikuj", "★ Dodaj do ulubionych", "Usuń stronę"]) {
      expect(within(menu).getByRole("menuitem", { name: new RegExp(nazwa) })).toBeInTheDocument();
    }
    expect(within(menu).getByText("Przenieś wyżej / niżej")).toBeInTheDocument();
    expect(within(menu).getByText("F2")).toBeInTheDocument();
  });

  it("„Zmień nazwę” zamyka menu i woła onRename", async () => {
    const onRename = vi.fn();
    const user = userEvent.setup();
    render(<Uprzaz onRename={onRename} />);
    await user.click(screen.getByRole("button", { name: "Menu strony Books" }));
    await user.click(screen.getByRole("menuitem", { name: /Zmień nazwę/ }));
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("„Przenieś wyżej / niżej” woła reorderPages ze zamienioną kolejnością", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("button", { name: "Przenieś wyżej" }));
    expect(reorderPages).toHaveBeenLastCalledWith(["b", "a", "c"]);
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("b,a,c");

    await user.click(screen.getByRole("button", { name: "Przenieś niżej" }));
    expect(reorderPages).toHaveBeenLastCalledWith(["a", "b", "c"]);
  });

  it("błąd zapisu kolejności cofa zmianę i pokazuje toast", async () => {
    reorderPages.mockResolvedValue({ ok: false, message: "x" });
    const user = await otworz();
    await user.click(screen.getByRole("button", { name: "Przenieś wyżej" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."),
    );
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("a,b,c");
  });

  it("siatka ikon ustawia ikonę", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Zmień ikonę/ }));
    expect(ICONS).toHaveLength(18);
    await user.click(screen.getByRole("button", { name: "Ikona ★" }));
    expect(setPageIcon).toHaveBeenCalledWith("b", "★");
    expect(screen.getByTestId("ikona")).toHaveTextContent("★");
  });

  it("ulubione: „Dodaj do ulubionych” woła setFavorite(id, true)", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: "★ Dodaj do ulubionych" }));
    expect(setFavorite).toHaveBeenCalledWith("b", true);
  });

  it("Duplikuj tworzy kopię i przechodzi do niej", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Duplikuj/ }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony/kopia"));
    expect(duplicatePage).toHaveBeenCalledWith("b");
  });

  it("„Usuń stronę” pyta o potwierdzenie; po „Usuń” woła deletePage, toast z „Cofnij”, wraca na /strony", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));

    const okno = await screen.findByRole("dialog");
    expect(within(okno).getByText("Usunąć stronę „Books”?")).toBeInTheDocument();
    expect(
      within(okno).getByText("11 wierszy trafi do kosza na 30 dni. Daty z tej strony znikną z kalendarza."),
    ).toBeInTheDocument();
    expect(deletePage).not.toHaveBeenCalled();

    await user.click(within(okno).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(deletePage).toHaveBeenCalledWith("b"));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/strony"));
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("a,c");

    expect(toast).toHaveBeenCalledWith(
      "Usunięto",
      expect.objectContaining({ action: expect.objectContaining({ label: "Cofnij" }) }),
    );
    const opcje = toast.mock.calls[0][1] as { action: { onClick: () => void } };
    opcje.action.onClick();
    expect(restorePage).toHaveBeenCalledWith("b");
  });

  it("nie przechodzi do /strony, gdy usunięto inną niż bieżącą stronę", async () => {
    sciezka = "/strony/a";
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(deletePage).toHaveBeenCalled());
    expect(push).not.toHaveBeenCalledWith("/strony");
  });

  it("błąd usuwania zostawia okno i pokazuje toast", async () => {
    deletePage.mockResolvedValue({ ok: false, message: "x" });
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("a,b,c");
  });

  it("nieudane „Cofnij” pokazuje toast z błędem", async () => {
    restorePage.mockResolvedValue({ ok: false, message: "x" });
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Usuń" }));
    await waitFor(() => expect(toast).toHaveBeenCalled());
    const opcje = toast.mock.calls[0][1] as { action: { onClick: () => Promise<void> } };
    await opcje.action.onClick();
    expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");

    toast.error.mockClear();
    restorePage.mockRejectedValue(new Error("sieć"));
    await opcje.action.onClick();
    expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie.");
  });

  it("odmiana w potwierdzeniu: 1 wiersz, 2 wiersze trafią, 12 wierszy", async () => {
    const { DeletePageDialog } = await import("./delete-page-dialog");
    const przypadki: [number, string][] = [
      [1, "1 wiersz trafi do kosza na 30 dni."],
      [2, "2 wiersze trafią do kosza na 30 dni."],
      [12, "12 wierszy trafi do kosza na 30 dni."],
      [0, "Strona trafi do kosza na 30 dni."],
    ];
    for (const [n, fragment] of przypadki) {
      const { unmount } = render(
        <DeletePageDialog page={strona("b", "Books", { rowCount: n })} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />,
      );
      expect(screen.getByText(new RegExp(`^${fragment.replace(/[.]/g, "\\.")}`))).toBeInTheDocument();
      unmount();
    }
  });
});
