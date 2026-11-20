"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Ellipsis,
  Pencil,
  Smile,
  Star,
  Trash2,
} from "lucide-react";

import {
  ActionPopover,
  FormDialog,
  MENU_ITEM,
  MENU_ITEM_DANGER,
  MENU_SEPARATOR,
} from "@/components/controls";
import { cn } from "@/lib/utils";
import { duplicatePage } from "./actions";
import { DeletePageDialog } from "./delete-page-dialog";
import { IconPicker } from "./icon-picker";
import { BLAD_ZAPISU } from "./messages";
import type { PageSummary } from "./load-pages";
import type { PagesStore } from "./use-pages-store";

const POZYCJA = MENU_ITEM;
const IKONA_POZYCJI = "w-[18px] font-mono text-muted-foreground";
// Skrót po prawej (.mi-sc)
const SKROT = "ml-auto text-xs tracking-[0.06em] text-muted-foreground";

// Menu strony (CPageMenu.dc.html, CSidebar.dc.html): na webie dymek 240 px, z `sheet` arkusz od dołu (telefon).
// Web ma ikony lucide 16 px jak makieta; arkusz telefonu zostaje przy znakach (układ telefonu bez zmian w tym etapie).
// Na webie kolejność zmienia się przeciąganiem w sidebarze, więc „Przenieś wyżej / niżej” jest tylko w arkuszu.
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
  // „Przenieś wyżej / niżej” działa w obrębie sekcji strony (Ulubione albo pozostałe), jak listy na telefonie
  const sekcja = pages.filter((p) => p.favorite === page.favorite);
  const indeks = sekcja.findIndex((p) => p.id === page.id);

  function zmienOtwarcie(nowe: boolean) {
    setOtwarte(nowe);
    // Po zamknięciu następne otwarcie zaczyna od listy pozycji
    if (!nowe) setWidok("menu");
  }

  function przenies(kierunek: -1 | 1) {
    const sasiad = sekcja[indeks + kierunek];
    if (indeks < 0 || sasiad === undefined) return;
    // Zamiana miejscami z sąsiadem z tej samej sekcji w pełnej kolejności stron
    const ids = pages.map((p) => p.id);
    const a = ids.indexOf(page.id);
    const b = ids.indexOf(sasiad.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
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

  // Ikony pozycji: web — lucide w kolorze muted-foreground, arkusz — dotychczasowe znaki
  const ikony = sheet
    ? {
        nazwa: <span aria-hidden="true" className={IKONA_POZYCJI}>✎</span>,
        ikona: <span aria-hidden="true" className={IKONA_POZYCJI}>◇</span>,
        dalej: <span aria-hidden="true" className="font-mono text-[11px] text-muted-foreground">›</span>,
        duplikuj: <span aria-hidden="true" className={IKONA_POZYCJI}>⧉</span>,
        usun: <span aria-hidden="true" className={`${IKONA_POZYCJI} text-destructive-foreground`}>✕</span>,
        wstecz: "←",
      }
    : {
        nazwa: <Pencil size={16} aria-hidden="true" className="flex-none text-muted-foreground" />,
        ikona: <Smile size={16} aria-hidden="true" className="flex-none text-muted-foreground" />,
        dalej: <ChevronRight size={14} aria-hidden="true" className="flex-none text-muted-foreground" />,
        duplikuj: <Copy size={16} aria-hidden="true" className="flex-none text-muted-foreground" />,
        usun: <Trash2 size={16} aria-hidden="true" className="flex-none" />,
        wstecz: <ChevronLeft size={16} aria-hidden="true" />,
      };

  const zawartosc =
    widok === "ikony" ? (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          {/* .btng.ic.xs */}
          <button
            type="button"
            aria-label="Wróć do menu"
            onClick={() => setWidok("menu")}
            className="inline-flex size-6 flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent p-0 font-[inherit] text-foreground outline-none hover:bg-accent focus-visible:shadow-focus max-[799px]:size-11"
          >
            {ikony.wstecz}
          </button>
          <span className="text-sm font-medium">Zmień ikonę</span>
        </div>
        <IconPicker
          value={page.icon}
          onPick={(ikona) => {
            zmienOtwarcie(false);
            if (ikona !== page.icon) void store.setIcon(page.id, ikona);
          }}
        />
      </div>
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
          {ikony.nazwa}
          <span className="flex-1">Zmień nazwę</span>
          <span className={sheet ? "font-mono text-[11px] text-muted-foreground" : SKROT}>F2</span>
        </button>
        <button
          type="button"
          role="menuitem"
          className={POZYCJA}
          onClick={() => setWidok("ikony")}
        >
          {ikony.ikona}
          <span className="flex-1">Zmień ikonę</span>
          {ikony.dalej}
        </button>
        <button type="button" role="menuitem" className={POZYCJA} onClick={duplikuj}>
          {ikony.duplikuj}
          <span className="flex-1">Duplikuj</span>
        </button>
        {/* Tylko arkusz (telefon); etykieta jak w makiecie, kierunek wybiera się strzałkami po prawej */}
        {sheet && (
          <div className={cn(POZYCJA, "cursor-default hover:bg-transparent")}>
            <span aria-hidden="true" className={IKONA_POZYCJI}>⇅</span>
            <span className="flex-1">Przenieś wyżej / niżej</span>
            <button
              type="button"
              aria-label="Przenieś wyżej"
              disabled={indeks <= 0}
              onClick={() => przenies(-1)}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded border border-input bg-white font-mono text-[11px] text-soft-foreground disabled:cursor-default disabled:opacity-40 max-[799px]:size-11"
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Przenieś niżej"
              disabled={indeks < 0 || indeks >= sekcja.length - 1}
              onClick={() => przenies(1)}
              className="inline-flex size-6 cursor-pointer items-center justify-center rounded border border-input bg-white font-mono text-[11px] text-soft-foreground disabled:cursor-default disabled:opacity-40 max-[799px]:size-11"
            >
              ↓
            </button>
          </div>
        )}
        <button
          type="button"
          role="menuitem"
          className={POZYCJA}
          onClick={() => {
            zmienOtwarcie(false);
            void store.setFavorite(page.id, !page.favorite);
          }}
        >
          {sheet ? (
            // Arkusz: gwiazdka w samym tekście pełni rolę ikony pozycji
            <span className="flex-1">
              {page.favorite ? "★ Usuń z ulubionych" : "★ Dodaj do ulubionych"}
            </span>
          ) : (
            <>
              <Star size={16} aria-hidden="true" className="flex-none text-muted-foreground" />
              {/* Nazwa pozycji bez zmian („★ …”) — gwiazdkę widać jako ikonę, znak zostaje dla czytników */}
              <span className="flex-1">
                <span className="sr-only">★</span>
                {page.favorite ? " Usuń z ulubionych" : " Dodaj do ulubionych"}
              </span>
            </>
          )}
        </button>
        <div className={MENU_SEPARATOR} />
        <button
          type="button"
          role="menuitem"
          className={cn(POZYCJA, MENU_ITEM_DANGER)}
          onClick={() => {
            zmienOtwarcie(false);
            setUsuwanie(true);
          }}
        >
          {ikony.usun}
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
        "flex size-6 cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent text-foreground outline-none hover:bg-accent focus-visible:shadow-focus aria-expanded:bg-accent"
      }
    >
      {sheet ? <span aria-hidden="true">⋯</span> : <Ellipsis size={16} aria-hidden="true" />}
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
          // Menu 240 px (.pop, padding 4 px); wybór ikony 300 px z odstępem 8 px jak w CSidebar
          width={widok === "ikony" ? 300 : 240}
          align="start"
          className={widok === "menu" ? "p-1" : "p-2"}
          ariaLabel={`Menu strony ${tytul}`}
        >
          {zawartosc}
        </ActionPopover>
      )}
      <DeletePageDialog
        page={page}
        open={usuwanie}
        onOpenChange={setUsuwanie}
        // Usuwana strona jest otwarta: przechodzimy na /strony, zanim wróci odpowiedź. Nawigacja wypiera
        // trwającą akcję z kolejki routera, więc odświeżona trasa (404 usuniętej strony) się nie pokaże
        onDeleteStart={() => {
          if (sciezka === `/strony/${page.id}`) router.replace("/strony");
        }}
        onDeleted={() => store.removeLocal(page.id)}
      />
    </>
  );
}
