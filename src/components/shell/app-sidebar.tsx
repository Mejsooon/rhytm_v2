"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Settings } from "lucide-react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { Button, FIELD, Kbd } from "@/components/controls";
import type { PageSummary } from "@/features/pages/load-pages";
import { PageIcon } from "@/features/pages/page-icon";
import { PageMenu } from "@/features/pages/page-menu";
import { HelpMenu } from "@/features/help/help-menu";
import { NotificationBell } from "@/features/notifications/inbox";
import { openSearch } from "@/features/search/open-search";
import { usePagesStore } from "@/features/pages/use-pages-store";
import { cn } from "@/lib/utils";
import { AccountPopover, type SidebarUser } from "./account-popover";
import { NAV_MODULES } from "./nav-items";
import { useSidebarState } from "./sidebar-state";
import { SidebarToggle } from "./sidebar-toggle";

// Pozycja .sb-i z coss.css: 32 px, promień 8 px, 14 px / 500
const POZYCJA =
  "flex h-8 items-center gap-2 rounded-[8px] px-2 text-sm font-medium no-underline transition-colors outline-none focus-visible:shadow-focus";
// Nieaktywna pozycja: tekst rgba(38,38,38,.72), najechanie bg rgba(0,0,0,.04)
const POZYCJA_ZWYKLA = "text-[rgba(38,38,38,.72)] hover:bg-black/[.04] hover:text-foreground";
// Nagłówek grupy .sb-g
const GRUPA = "text-xs font-medium text-muted-foreground";

// Szyna schowanego paska (.rail z S2SidebarCollapsed): przyciski i linki 36 px, promień 8 px
const POZYCJA_SZYNY =
  "grid size-9 flex-none place-items-center rounded-[8px] no-underline outline-none transition-colors focus-visible:shadow-focus";
// Kreska między grupami szyny: 24 × 1 px, 6 px odstępu
const KRESKA_SZYNY = "my-1.5 h-px w-6 flex-none bg-black/[.08]";

// Sidebar web (S2Sidebar.dc.html): 232 px, przyklejony do góry, poniżej 800 px ukryty (jest TabBar).
// Schowany (Ctrl+\) zamienia się w szynę 56 px z ikonami (S2SidebarCollapsed); karty planu z makiety
// jeszcze nie ma (pakiet Plan Free/Pro).
// Strony: kolejność z `position`; ulubione są tylko w sekcji „Ulubione” (ukrytej, gdy pusta).
// Przeciąganie w obrębie sekcji zmienia kolejność, upuszczenie w drugiej sekcji przełącza ulubione.
// F2 zmienia nazwę aktywnej, „⋯” otwiera menu strony (PageMenu). Pusty tytuł → „Bez tytułu”.
export function AppSidebar({
  user,
  pages = [],
}: {
  user: SidebarUser;
  pages?: PageSummary[];
}) {
  const sciezka = usePathname();
  const { collapsed } = useSidebarState();
  const store = usePagesStore(pages);
  const strony = store.pages;

  const [edytowana, setEdytowana] = React.useState<string | null>(null);
  const [szkic, setSzkic] = React.useState("");
  // Esc i Enter kończą edycję same; flaga blokuje drugi zapis z onBlur przy odmontowaniu pola
  const zakonczono = React.useRef(false);
  const [przeciagana, setPrzeciagana] = React.useState<string | null>(null);
  // Cel upuszczenia pod kursorem: wiersz (przed nim, po = false, albo za nim, po = true)
  // albo koniec sekcji (nagłówek i pas pod ostatnim wierszem) — Ulubione (true) lub Strony (false)
  const [nad, setNad] = React.useState<
    { typ: "wiersz"; id: string; po: boolean } | { typ: "koniec"; ulubione: boolean } | null
  >(null);

  const aktywnaStrona = strony.find((s) => sciezka === `/strony/${s.id}`);
  const aktywnaStronaId = aktywnaStrona?.id;
  const aktywnaStronaTytul = aktywnaStrona?.title;

  // F2 na aktywnej stronie włącza zmianę nazwy (poza polami tekstowymi)
  React.useEffect(() => {
    if (aktywnaStronaId === undefined) return;
    function przyKlawiszu(e: KeyboardEvent) {
      if (e.key !== "F2") return;
      const cel = e.target as HTMLElement | null;
      if (cel && (cel.closest("input, textarea, select, [contenteditable='true']") !== null)) return;
      e.preventDefault();
      zakonczono.current = false;
      setSzkic(aktywnaStronaTytul ?? "");
      setEdytowana(aktywnaStronaId ?? null);
    }
    window.addEventListener("keydown", przyKlawiszu);
    return () => window.removeEventListener("keydown", przyKlawiszu);
  }, [aktywnaStronaId, aktywnaStronaTytul]);

  function zapiszNazwe(strona: PageSummary) {
    if (zakonczono.current) return;
    zakonczono.current = true;
    setEdytowana(null);
    const nowa = szkic.trim();
    if (nowa !== strona.title.trim()) void store.rename(strona.id, nowa);
  }

  function upusc(cel: NonNullable<typeof nad>) {
    const zrodloId = przeciagana;
    setPrzeciagana(null);
    setNad(null);
    const zrodlo = strony.find((s) => s.id === zrodloId);
    if (!zrodlo) return;
    if (cel.typ === "wiersz" && cel.id === zrodlo.id) return;
    const ulubiona = cel.typ === "wiersz" ? strony.find((s) => s.id === cel.id)?.favorite : cel.ulubione;
    if (ulubiona === undefined) return;
    // Kolejność jest jedna dla ulubionych i pozostałych: wstawiamy stronę w pełnej liście,
    // więc wzajemny układ stron w obu sekcjach zostaje
    const stare = strony.map((s) => s.id);
    const ids = stare.filter((id) => id !== zrodlo.id);
    if (cel.typ === "wiersz") {
      const i = ids.indexOf(cel.id);
      ids.splice(cel.po ? i + 1 : i, 0, zrodlo.id);
    } else {
      // Koniec sekcji: za jej ostatnią stroną; pusta sekcja — strona zostaje na swoim miejscu w kolejności
      const wSekcji = ids.filter((id) => strony.find((s) => s.id === id)?.favorite === ulubiona);
      const ostatnia = wSekcji.at(-1);
      ids.splice(ostatnia === undefined ? stare.indexOf(zrodlo.id) : ids.indexOf(ostatnia) + 1, 0, zrodlo.id);
    }
    // Druga sekcja (Ulubione ↔ Strony): ulubione i kolejność jednym zapisem (move_page); ta sama — sama kolejność
    if (zrodlo.favorite !== ulubiona) void store.move(ids, zrodlo.id, ulubiona);
    else if (ids.join(",") !== stare.join(",")) void store.reorder(ids);
  }

  const sekcje = [
    { nazwa: "Ulubione", lista: strony.filter((s) => s.favorite) },
    { nazwa: "Strony", lista: strony.filter((s) => !s.favorite) },
  ];

  const aktywna = (href: string) =>
    sciezka === href || sciezka.startsWith(`${href}/`);
  const klasaPozycji = (href: string) =>
    cn(
      POZYCJA,
      aktywna(href) ? "bg-black/5 text-foreground" : POZYCJA_ZWYKLA,
    );
  const klasaSzyny = (href: string) =>
    cn(
      POZYCJA_SZYNY,
      aktywna(href)
        ? "bg-black/5 text-foreground"
        : "text-[rgba(38,38,38,.68)] hover:bg-black/[.04] hover:text-foreground",
    );

  if (collapsed) {
    return (
      <nav
        aria-label="Główna nawigacja (zwinięta)"
        className="sticky top-0 flex h-dvh w-14 flex-none flex-col items-center gap-0.5 overflow-y-auto border-r border-border-soft bg-panel px-2.5 py-2 text-foreground max-[799px]:hidden"
      >
        <span className="grid h-10 flex-none place-items-center">
          <RhytmLogo size={22} />
        </span>
        <SidebarToggle placement="rail" />
        <NotificationBell compact />
        <button
          type="button"
          onClick={openSearch}
          aria-label="Szukaj"
          title="Szukaj · ⌘K"
          className={cn(klasaSzyny("/szukaj"), "cursor-pointer border-0 bg-transparent")}
        >
          <Search size={16} aria-hidden="true" />
        </button>
        <span aria-hidden="true" className={KRESKA_SZYNY} />
        {NAV_MODULES.map(({ key, label, href, icon: Ikona }) => (
          <Link
            key={key}
            href={href}
            aria-label={label}
            title={label}
            aria-current={aktywna(href) ? "page" : undefined}
            className={klasaSzyny(href)}
          >
            <Ikona size={16} aria-hidden="true" />
          </Link>
        ))}
        <span aria-hidden="true" className={KRESKA_SZYNY} />
        {/* Strony w kolejności paska: najpierw ulubione, potem pozostałe */}
        {[...sekcje[0].lista, ...sekcje[1].lista].map((strona) => {
          const href = `/strony/${strona.id}`;
          const tytul = strona.title.trim() === "" ? "Bez tytułu" : strona.title;
          return (
            <Link
              key={strona.id}
              href={href}
              aria-label={tytul}
              title={tytul}
              aria-current={aktywna(href) ? "page" : undefined}
              className={klasaSzyny(href)}
            >
              <PageIcon icon={strona.icon} size={16} />
            </Link>
          );
        })}
        <span className="min-h-6 flex-1" />
        <HelpMenu email={user.email} compact />
        <Link
          href="/ustawienia/ogolne"
          aria-label="Ustawienia"
          title="Ustawienia"
          aria-current={aktywna("/ustawienia") ? "page" : undefined}
          className={klasaSzyny("/ustawienia")}
        >
          <Settings size={16} aria-hidden="true" />
        </Link>
        <AccountPopover user={user} compact />
      </nav>
    );
  }

  return (
    <nav
      aria-label="Główna nawigacja"
      className={cn(
        // Na telefonie nawigacja to dolny pasek
        "sticky top-0 hidden h-dvh w-[232px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-border-soft bg-panel p-2 text-sm text-foreground min-[800px]:flex",
      )}
    >
      {/* Logo 22 px i nazwa 15 px / 600 w wierszu 40 px */}
      <div className="flex h-10 items-center gap-2 px-2">
        <RhytmLogo size={22} />
        <span className="flex-1 text-[15px] font-semibold tracking-[-0.03em]">rhytm</span>
        <NotificationBell />
        <SidebarToggle placement="sidebar" />
      </div>

      {/* Wyszukiwarka w wyglądzie .igroup otwiera okno szukania; ⌘K / Ctrl+K robi to samo z klawiatury */}
      <button
        type="button"
        onClick={openSearch}
        // .igroup z coss.css
        className="mt-1 mb-2 flex h-8 flex-none cursor-pointer items-center gap-2 rounded-md border border-input bg-white bg-clip-padding px-[11px] text-left text-sm text-muted-foreground shadow-xs outline-none transition-colors hover:bg-panel focus-visible:shadow-focus"
      >
        <Search size={16} aria-hidden="true" />
        <span className="flex-1">Szukaj…</span>
        <Kbd>⌘K</Kbd>
      </button>

      <div className={cn(GRUPA, "px-2 pt-3 pb-1")}>Moduły</div>
      {NAV_MODULES.map(({ key, label, href, icon: Ikona }) => (
        <Link
          key={key}
          href={href}
          aria-current={aktywna(href) ? "page" : undefined}
          className={klasaPozycji(href)}
        >
          <Ikona size={16} aria-hidden="true" />
          {label}
        </Link>
      ))}

      {/* Strony: wyjście kursora poza listę czyści wskaźnik upuszczenia */}
      <div
        className="flex flex-col gap-0.5"
        onDragLeave={(e) => {
          const dokad = e.relatedTarget as Node | null;
          if (dokad === null || !e.currentTarget.contains(dokad)) setNad(null);
        }}
      >
        {sekcje.map(({ nazwa, lista }) => {
          const ulubione = nazwa === "Ulubione";
          // „Ulubione” bez stron pokazuje się tylko w trakcie przeciągania (ze strefą upuszczenia)
          if (ulubione && lista.length === 0 && przeciagana === null) return null;
          const koniecAktywny = nad?.typ === "koniec" && nad.ulubione === ulubione;
          // Nagłówek sekcji i pas pod ostatnim wierszem: upuszczenie dopisuje stronę na koniec sekcji
          const celKonca = {
            onDragOver: (e: React.DragEvent) => {
              if (przeciagana === null) return;
              e.preventDefault();
              if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
              if (!koniecAktywny) setNad({ typ: "koniec", ulubione });
            },
            onDrop: (e: React.DragEvent) => {
              e.preventDefault();
              upusc({ typ: "koniec", ulubione });
            },
          };
          return (
            <React.Fragment key={nazwa}>
              {/* .sb-g z odstępem 16 px; przy „Strony” przycisk „+” (ghost xs) */}
              <div
                {...celKonca}
                className={cn("flex items-center justify-between pt-4 pb-1 pl-2", ulubione ? "pr-2" : "pr-1")}
              >
                <span className={GRUPA}>{nazwa}</span>
                {nazwa === "Strony" && (
                  <Button
                    variant="ghost"
                    size="xs"
                    icon
                    aria-label="Dodaj stronę"
                    asChild
                    className="text-muted-foreground"
                  >
                    {/* Wybór szablonu (albo pustej strony) jest na /strony/nowa */}
                    <Link href="/strony/nowa">
                      <Plus size={16} aria-hidden="true" />
                    </Link>
                  </Button>
                )}
              </div>
              {lista.map((strona) => {
                const href = `/strony/${strona.id}`;
                const tytul = strona.title.trim() === "" ? "Bez tytułu" : strona.title;
                return (
                  <div
                    key={strona.id}
                    className={cn(
                      "group relative rounded-[8px]",
                      // Linia wskaźnika upuszczenia 2 px nad albo pod wierszem, przeciągana strona przygaszona
                      nad?.typ === "wiersz" &&
                        nad.id === strona.id &&
                        przeciagana !== strona.id &&
                        (nad.po
                          ? "shadow-[inset_0_-2px_0_var(--foreground)]"
                          : "shadow-[inset_0_2px_0_var(--foreground)]"),
                      przeciagana === strona.id && "opacity-[.45]",
                    )}
                    onDragStart={(e) => {
                      setPrzeciagana(strona.id);
                      if (e.dataTransfer) {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", strona.id);
                      }
                    }}
                    onDragOver={(e) => {
                      if (przeciagana === null) return;
                      e.preventDefault();
                      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
                      const ramka = e.currentTarget.getBoundingClientRect();
                      const po = e.clientY > ramka.top + ramka.height / 2;
                      if (nad?.typ !== "wiersz" || nad.id !== strona.id || nad.po !== po)
                        setNad({ typ: "wiersz", id: strona.id, po });
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      upusc({ typ: "wiersz", id: strona.id, po: nad?.typ === "wiersz" && nad.id === strona.id && nad.po });
                    }}
                    onDragEnd={() => {
                      setPrzeciagana(null);
                      setNad(null);
                    }}
                  >
                    {edytowana === strona.id ? (
                      // Pole nazwy jak .inp w CSidebar: cały wiersz, ramka ring i halo 3 px
                      <div className="flex h-8 items-center">
                        <input
                          autoFocus
                          aria-label="Nazwa strony"
                          value={szkic}
                          maxLength={200}
                          placeholder="Bez tytułu"
                          onFocus={(e) => e.currentTarget.select()}
                          onChange={(e) => setSzkic(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              zapiszNazwe(strona);
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              zakonczono.current = true;
                              setEdytowana(null);
                            }
                          }}
                          onBlur={() => zapiszNazwe(strona)}
                          className={cn(FIELD, "border-ring shadow-halo")}
                        />
                      </div>
                    ) : (
                      <Link
                        href={href}
                        draggable
                        aria-current={aktywna(href) ? "page" : undefined}
                        className={cn(klasaPozycji(href), "pr-8")}
                      >
                        <PageIcon icon={strona.icon} size={16} />
                        <span className="min-w-0 flex-1 truncate">{tytul}</span>
                      </Link>
                    )}
                    {edytowana !== strona.id && (
                      <div className="absolute top-1 right-1">
                        <PageMenu
                          page={strona}
                          pages={strony}
                          store={store}
                          onRename={() => {
                            zakonczono.current = false;
                            setSzkic(strona.title);
                            setEdytowana(strona.id);
                          }}
                          // .btng.ic.xs: widoczny na aktywnej stronie, po najechaniu, z fokusem i przy otwartym menu
                          triggerClassName={cn(
                            "flex size-6 cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent text-foreground outline-none hover:bg-accent focus-visible:opacity-100 focus-visible:shadow-focus aria-expanded:bg-accent data-[state=open]:opacity-100 [&_svg]:opacity-80",
                            aktywna(href) ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                          )}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
              {przeciagana !== null &&
                (ulubione && lista.length === 0 ? (
                  <div
                    {...celKonca}
                    data-testid="strefa-ulubione"
                    className={cn(
                      "mx-1 rounded-md border border-dashed bg-muted px-2 py-2 text-center text-xs text-muted-foreground",
                      koniecAktywny ? "border-primary bg-muted" : "border-border-strong",
                    )}
                  >
                    Upuść tutaj, aby dodać do ulubionych
                  </div>
                ) : (
                  <div
                    {...celKonca}
                    data-testid={`koniec-${ulubione ? "ulubione" : "strony"}`}
                    className={cn("h-3 rounded-md", koniecAktywny && "shadow-[inset_0_2px_0_var(--foreground)]")}
                  />
                ))}
            </React.Fragment>
          );
        })}
      </div>
      <Link href="/strony/nowa" className={cn(POZYCJA, POZYCJA_ZWYKLA)}>
        <Plus size={16} aria-hidden="true" />
        Nowa strona
      </Link>

      <div className="min-h-6 flex-1" />
      <HelpMenu email={user.email} />
      {/* Web prowadzi wprost do „Ogólne” (/ustawienia to na telefonie indeks), ale aktywna jest każda podstrona /ustawienia */}
      <Link
        href="/ustawienia/ogolne"
        aria-current={aktywna("/ustawienia") ? "page" : undefined}
        className={klasaPozycji("/ustawienia")}
      >
        <Settings size={16} aria-hidden="true" />
        Ustawienia
      </Link>
      <div className="mt-1.5 border-t border-border-soft pt-1.5">
        <AccountPopover user={user} />
      </div>
    </nav>
  );
}
