import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

let sciezka = "/strony/b";
const {
  push,
  replace,
  toast,
  reorderPages,
  deletePage,
  restorePage,
  setPageIcon,
  setFavorite,
  duplicatePage,
  countPageRows,
} = vi.hoisted(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    countPageRows: vi.fn(),
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
  useRouter: () => ({ push, replace, back: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("./actions", () => ({
  reorderPages,
  deletePage,
  restorePage,
  setPageIcon,
  setFavorite,
  duplicatePage,
  countPageRows,
  renamePage: vi.fn(),
}));

import type { PageSummary } from "./load-pages";
import { PageMenu } from "./page-menu";
import { usePagesStore } from "./use-pages-store";

function strona(id: string, title: string, reszta: Partial<PageSummary> = {}): PageSummary {
  return { id, title, icon: "▤", favorite: false, templateKey: "books", position: 0, rowCount: 11, ...reszta };
}

const POCZATKOWE = [strona("a", "Alfa"), strona("b", "Books"), strona("c", "Gamma")];

// Menu strony „Books” z prawdziwym magazynem (optymistyczne zmiany widać w `pages`)
function Uprzaz({ onRename = vi.fn(), sheet = false }: { onRename?: () => void; sheet?: boolean }) {
  const store = usePagesStore(POCZATKOWE);
  const books = store.pages.find((p) => p.id === "b");
  return (
    <>
      <output data-testid="kolejnosc">{store.pages.map((p) => p.id).join(",")}</output>
      <output data-testid="ikona">{books?.icon}</output>
      {books && <PageMenu page={books} pages={store.pages} store={store} onRename={onRename} sheet={sheet} />}
    </>
  );
}

async function otworz(sheet = false) {
  const user = userEvent.setup();
  render(<Uprzaz sheet={sheet} />);
  await user.click(screen.getByRole("button", { name: "Menu strony Books" }));
  return user;
}

describe("PageMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sciezka = "/strony/b";
    reorderPages.mockResolvedValue({ ok: true });
    deletePage.mockResolvedValue({ ok: true });
    // Domyślnie świeża liczba wierszy jeszcze nie wróciła — okno pokazuje liczbę z listy stron
    countPageRows.mockReturnValue(new Promise(() => {}));
    restorePage.mockResolvedValue({ ok: true });
    setPageIcon.mockResolvedValue({ ok: true });
    setFavorite.mockResolvedValue({ ok: true });
    duplicatePage.mockResolvedValue({ ok: true, id: "kopia" });
  });

  it("pokazuje pozycje z makiety i „Dodaj do ulubionych” (nazwa bez „★”)", async () => {
    await otworz();
    const menu = screen.getByRole("menu", { name: "Strona Books" });
    for (const nazwa of ["Zmień nazwę", "Zmień ikonę", "Duplikuj", "Dodaj do ulubionych", "Usuń stronę"]) {
      expect(within(menu).getByRole("menuitem", { name: new RegExp(nazwa) })).toBeInTheDocument();
    }
    expect(within(menu).getByText("F2")).toBeInTheDocument();
    // Na webie kolejność zmienia się przeciąganiem w sidebarze
    expect(within(menu).queryByText("Przenieś wyżej / niżej")).toBeNull();
    expect(screen.queryByRole("button", { name: "Przenieś wyżej" })).toBeNull();
  });

  it("arkusz (telefon) zostawia „Przenieś wyżej / niżej”", async () => {
    await otworz(true);
    expect(screen.getByText("Przenieś wyżej / niżej")).toBeInTheDocument();
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

  it("„Przenieś wyżej / niżej” w arkuszu woła reorderPages ze zamienioną kolejnością", async () => {
    const user = await otworz(true);
    await user.click(screen.getByRole("button", { name: "Przenieś wyżej" }));
    expect(reorderPages).toHaveBeenLastCalledWith(["b", "a", "c"]);
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("b,a,c");

    await user.click(screen.getByRole("button", { name: "Przenieś niżej" }));
    expect(reorderPages).toHaveBeenLastCalledWith(["a", "b", "c"]);
  });

  it("w arkuszu przenosi w obrębie sekcji: ulubiona strona zamienia się z sąsiednią ulubioną", async () => {
    const lista = [strona("a", "Alfa", { favorite: true }), strona("x", "Iks"), strona("b", "Books", { favorite: true })];
    function UprzazUlubione() {
      const store = usePagesStore(lista);
      const books = store.pages.find((p) => p.id === "b")!;
      return (
        <>
          <output data-testid="kolejnosc">{store.pages.map((p) => p.id).join(",")}</output>
          <PageMenu page={books} pages={store.pages} store={store} onRename={vi.fn()} sheet />
        </>
      );
    }
    const user = userEvent.setup();
    render(<UprzazUlubione />);
    await user.click(screen.getByRole("button", { name: "Menu strony Books" }));
    // Books jest ostatnia wśród ulubionych, choć Iks (nieulubiona) stoi przed nią w pełnej liście
    expect(screen.getByRole("button", { name: "Przenieś niżej" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Przenieś wyżej" }));
    expect(reorderPages).toHaveBeenLastCalledWith(["b", "x", "a"]);
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("b,x,a");
  });

  it("błąd zapisu kolejności cofa zmianę i pokazuje toast", async () => {
    reorderPages.mockResolvedValue({ ok: false, message: "x" });
    const user = await otworz(true);
    await user.click(screen.getByRole("button", { name: "Przenieś wyżej" }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Nie udało się zapisać. Spróbuj ponownie."),
    );
    expect(screen.getByTestId("kolejnosc")).toHaveTextContent("a,b,c");
  });

  it("„Zmień ikonę” otwiera IconPicker; emoji ustawia ikonę, „Wróć do menu” wraca", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Zmień ikonę/ }));
    expect(screen.getByRole("group", { name: "Wybór ikony" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Wróć do menu" }));
    expect(screen.getByRole("menu", { name: "Strona Books" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: /Zmień ikonę/ }));
    await user.click(screen.getByRole("button", { name: "Emoji książki books" }));
    expect(setPageIcon).toHaveBeenCalledWith("b", "📚");
    expect(screen.getByTestId("ikona")).toHaveTextContent("📚");
    expect(screen.queryByRole("group", { name: "Wybór ikony" })).toBeNull();
  });

  it("ikona liniowa w kolorze i „Usuń” zapisują `lucide:…` i ''", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Zmień ikonę/ }));
    await user.click(screen.getByRole("button", { name: "Ikony" }));
    await user.click(screen.getByRole("button", { name: "Zielony" }));
    await user.click(screen.getByRole("button", { name: "Ikona start projekt" }));
    expect(setPageIcon).toHaveBeenLastCalledWith("b", "lucide:rocket:green");

    await user.click(screen.getByRole("button", { name: "Menu strony Books" }));
    await user.click(screen.getByRole("menuitem", { name: /Zmień ikonę/ }));
    await user.click(screen.getByRole("button", { name: "Usuń" }));
    expect(setPageIcon).toHaveBeenLastCalledWith("b", "");
  });

  it("ulubione: „Dodaj do ulubionych” woła setFavorite(id, true)", async () => {
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: "Dodaj do ulubionych" }));
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
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/strony"));
    await waitFor(() => expect(screen.getByTestId("kolejnosc")).toHaveTextContent("a,c"));

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
    expect(replace).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });

  it("usuwając otwartą stronę przechodzi na /strony od razu, nie czekając na odpowiedź serwera", async () => {
    let zakoncz: (v: { ok: true }) => void = () => {};
    deletePage.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Usuń" }));
    expect(deletePage).toHaveBeenCalledWith("b");
    // Odpowiedź (z odświeżoną trasą usuniętej strony) jeszcze nie wróciła, a nawigacja już ruszyła
    expect(replace).toHaveBeenCalledWith("/strony");
    expect(toast).not.toHaveBeenCalled();
    zakoncz({ ok: true });
    await waitFor(() => expect(toast).toHaveBeenCalledWith("Usunięto", expect.anything()));
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("okno pobiera świeżą liczbę wierszy przy otwarciu i ją pokazuje", async () => {
    let zakoncz: (v: { ok: true; count: number }) => void = () => {};
    countPageRows.mockReturnValue(new Promise((r) => (zakoncz = r)));
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    const okno = await screen.findByRole("dialog");
    expect(countPageRows).toHaveBeenCalledWith("b");
    // Do czasu odpowiedzi — liczba z listy stron (11)
    expect(within(okno).getByText(/^11 wierszy trafi/)).toBeInTheDocument();
    zakoncz({ ok: true, count: 3 });
    expect(await within(okno).findByText(/^3 wiersze trafią do kosza na 30 dni\./)).toBeInTheDocument();
  });

  it("błąd odczytu liczby wierszy zostawia liczbę z listy stron", async () => {
    countPageRows.mockResolvedValue({ ok: false, message: "x" });
    const user = await otworz();
    await user.click(screen.getByRole("menuitem", { name: /Usuń stronę/ }));
    const okno = await screen.findByRole("dialog");
    await waitFor(() => expect(countPageRows).toHaveBeenCalled());
    expect(within(okno).getByText(/^11 wierszy trafi/)).toBeInTheDocument();
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

  it("okno usuwania jak .dlg ze wzoru Sportu: zwarte 400 px, cień pop, szara stopka, ikona kosza", async () => {
    const { DeletePageDialog } = await import("./delete-page-dialog");
    render(<DeletePageDialog page={strona("b", "Books", { rowCount: 3 })} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />);
    const okno = screen.getByRole("dialog");
    expect(okno.className).toContain("min-[800px]:shadow-pop");
    expect(okno.className).toContain("w-[min(400px,calc(100%-32px))]");
    const usun = within(okno).getByRole("button", { name: "Usuń" });
    expect(usun.querySelector("svg")).not.toBeNull();
    expect(usun.parentElement?.className).toContain("min-[800px]:bg-black/[.025]");
  });

  it("na telefonie okno usuwania to arkusz od dołu z uchwytem, a opis jest powiązany przez aria-describedby", async () => {
    const { DeletePageDialog } = await import("./delete-page-dialog");
    render(<DeletePageDialog page={strona("b", "Books", { rowCount: 3 })} open onOpenChange={vi.fn()} onDeleted={vi.fn()} />);
    const okno = screen.getByRole("dialog");
    expect(okno).toHaveClass("max-[799px]:inset-x-0", "max-[799px]:bottom-0", "max-[799px]:rounded-t-[18px]", "max-[799px]:rounded-b-none");
    expect(okno.querySelector("div[aria-hidden='true']")).toHaveClass("min-[800px]:hidden");
    const opis = screen.getByText(/do kosza na 30 dni/);
    expect(opis.id).not.toBe("");
    expect(okno).toHaveAttribute("aria-describedby", opis.id);
  });
});
