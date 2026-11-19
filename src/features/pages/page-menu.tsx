"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";

import { ActionPopover, FormDialog } from "@/components/controls";
import { duplicatePage } from "./actions";
import { DeletePageDialog } from "./delete-page-dialog";
import { IconGrid } from "./icon-grid";
import { BLAD_ZAPISU } from "./messages";
import type { PageSummary } from "./load-pages";
import type { PagesStore } from "./use-pages-store";

const POZYCJA =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-md border-0 bg-transparent px-2.5 py-[7px] text-left text-[13px] text-[#171717] hover:bg-[#f5f5f5] max-[799px]:min-h-11";
const IKONA_POZYCJI = "w-[18px] font-mono text-[#6b6b6b]";

// Menu strony (PageMenu.dc.html): na webie dymek 230 px, z `sheet` arkusz od dołu (telefon).
// `pages` to cała lista w kolejności (dla „Przenieś wyżej / niżej”), `store` — optymistyczne zmiany.
export function PageMenu({
  page,
  pages,
  store,
  onRename,
  sheet = false,
  triggerClassName,
  triggerLabel,
}: {
  page: PageSummary;
  pages: PageSummary[];
  store: PagesStore;
  onRename: () => void;
  sheet?: boolean;
  triggerClassName?: string;
  // Własna etykieta przycisku (telefon: samo „Menu strony”); domyślnie z tytułem strony
  triggerLabel?: string;
}) {
  const router = useRouter();
  const sciezka = usePathname();
  const [otwarte, setOtwarte] = React.useState(false);
  const [widok, setWidok] = React.useState<"menu" | "ikony">("menu");
  const [usuwanie, setUsuwanie] = React.useState(false);

  const tytul = page.title.trim() === "" ? "Bez tytułu" : page.title;
  const indeks = pages.findIndex((p) => p.id === page.id);

  function zmienOtwarcie(nowe: boolean) {
    setOtwarte(nowe);
    // Po zamknięciu następne otwarcie zaczyna od listy pozycji
    if (!nowe) setWidok("menu");
  }

  function przenies(kierunek: -1 | 1) {
    const cel = indeks + kierunek;
    if (indeks < 0 || cel < 0 || cel >= pages.length) return;
    const ids = pages.map((p) => p.id);
    [ids[indeks], ids[cel]] = [ids[cel], ids[indeks]];
    void store.reorder(ids);
  }

  async function duplikuj() {
    zmienOtwarcie(false);
    let wynik: Awaited<ReturnType<typeof duplicatePage>> | null = null;
    try {
      wynik = await duplicatePage(page.id);
    } catch {
      wynik = null;
    }
    if (!wynik || !wynik.ok) {
      toast.error(BLAD_ZAPISU);
      return;
    }
    router.push(`/strony/${wynik.id}`);
  }

  const zawartosc =
    widok === "ikony" ? (
      <IconGrid
        current={page.icon}
        onPick={(ikona) => {
          zmienOtwarcie(false);
          void store.setIcon(page.id, ikona);
        }}
      />
    ) : (
      <div role="menu" aria-label={`Strona ${tytul}`}>
        <button
          type="button"
          role="menuitem"
          className={POZYCJA}
          onClick={() => {
            zmienOtwarcie(false);
            onRename();
          }}
        >
          <span aria-hidden="true" className={IKONA_POZYCJI}>✎</span>
          <span className="flex-1">Zmień nazwę</span>
          <span className="font-mono text-[11px] text-[#6b6b6b]">F2</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className={POZYCJA}
          onClick={() => setWidok("ikony")}
        >
          <span aria-hidden="true" className={IKONA_POZYCJI}>◇</span>
          <span className="flex-1">Zmień ikonę</span>
          <span aria-hidden="true" className="font-mono text-[11px] text-[#6b6b6b]">›</span>
        </button>
        <button type="button" role="menuitem" className={POZYCJA} onClick={duplikuj}>
          <span aria-hidden="true" className={IKONA_POZYCJI}>⧉</span>
          <span className="flex-1">Duplikuj</span>
        </button>
        {/* Etykieta jak w makiecie; kierunek wybiera się strzałkami po prawej */}
        <div className={`${POZYCJA} cursor-default hover:bg-transparent`}>
          <span aria-hidden="true" className={IKONA_POZYCJI}>⇅</span>
          <span className="flex-1">Przenieś wyżej / niżej</span>
          <button
            type="button"
            aria-label="Przenieś wyżej"
            disabled={indeks <= 0}
            onClick={() => przenies(-1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded border border-[#e0e0e0] bg-white font-mono text-[11px] text-[#404040] disabled:cursor-default disabled:opacity-40 max-[799px]:size-11"
          >
            ↑
          </button>
          <button
            type="button"
            aria-label="Przenieś niżej"
            disabled={indeks < 0 || indeks >= pages.length - 1}
            onClick={() => przenies(1)}
            className="inline-flex size-6 cursor-pointer items-center justify-center rounded border border-[#e0e0e0] bg-white font-mono text-[11px] text-[#404040] disabled:cursor-default disabled:opacity-40 max-[799px]:size-11"
          >
            ↓
          </button>
        </div>
        <button
          type="button"
          role="menuitem"
          className={POZYCJA}
          onClick={() => {
            zmienOtwarcie(false);
            void store.setFavorite(page.id, !page.favorite);
          }}
        >
          {/* Gwiazdka w samym tekście pełni rolę ikony pozycji */}
          <span className="flex-1">
            {page.favorite ? "★ Usuń z ulubionych" : "★ Dodaj do ulubionych"}
          </span>
        </button>
        <div className="mx-1 my-1.5 h-px bg-[#eaeaea]" />
        <button
          type="button"
          role="menuitem"
          className={`${POZYCJA} text-[#b91c1c]`}
          onClick={() => {
            zmienOtwarcie(false);
            setUsuwanie(true);
          }}
        >
          <span aria-hidden="true" className={`${IKONA_POZYCJI} text-[#b91c1c]`}>✕</span>
          <span className="flex-1">Usuń stronę</span>
        </button>
      </div>
    );

  const przycisk = (
    <button
      type="button"
      aria-label={triggerLabel ?? `Menu strony ${tytul}`}
      aria-haspopup="menu"
      aria-expanded={otwarte}
      onClick={sheet ? () => zmienOtwarcie(true) : undefined}
      className={
        triggerClassName ??
        "flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent font-mono text-[#666666] hover:bg-[#ebebeb]"
      }
    >
      <span aria-hidden="true">⋯</span>
    </button>
  );

  return (
    <>
      {sheet ? (
        <>
          {przycisk}
          <FormDialog open={otwarte} onOpenChange={zmienOtwarcie} title={tytul}>
            {zawartosc}
          </FormDialog>
        </>
      ) : (
        <ActionPopover
          trigger={przycisk}
          open={otwarte}
          onOpenChange={zmienOtwarcie}
          width={widok === "ikony" ? 236 : 230}
          align="start"
          ariaLabel={`Menu strony ${tytul}`}
        >
          {zawartosc}
        </ActionPopover>
      )}
      <DeletePageDialog
        page={page}
        open={usuwanie}
        onOpenChange={setUsuwanie}
        onDeleted={() => {
          store.removeLocal(page.id);
          if (sciezka === `/strony/${page.id}`) router.push("/strony");
        }}
      />
    </>
  );
}
