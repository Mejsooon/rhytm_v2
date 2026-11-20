"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus, Search, Settings } from "lucide-react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { MonoLabel } from "@/components/controls";
import { useCreateBlankPage } from "@/features/pages/use-create-blank-page";
import type { PageSummary } from "@/features/pages/load-pages";
import { PageIcon } from "@/features/pages/page-icon";
import { PageMenu } from "@/features/pages/page-menu";
import { usePagesStore } from "@/features/pages/use-pages-store";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { AccountPopover, type SidebarUser } from "./account-popover";
import { NAV_MODULES } from "./nav-items";

const POZYCJA =
  "flex items-center gap-2.5 rounded-md px-2 py-[7px] no-underline transition-colors";

// Sidebar web (Sidebar.dc.html): 232 px, przyklejony do góry, poniżej 800 px ukryty (jest TabBar).
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
  const nowaStrona = useCreateBlankPage();
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
      aktywna(href)
        ? "bg-active font-medium text-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground",
    );

  return (
    <nav
      aria-label="Główna nawigacja"
      className="sticky top-0 hidden h-dvh w-[232px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-border bg-panel px-2.5 py-3 text-sm text-foreground min-[800px]:flex"
    >
      <div className="flex items-center gap-2.5 px-2 pt-1.5 pb-2">
        <RhytmLogo withWordmark />
      </div>

      {/* Wyszukiwarka (⌘K) — w tym etapie nieaktywna */}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled="true"
            className="mt-0.5 mb-2.5 flex cursor-default items-center gap-2 rounded-md border border-border bg-white px-2.5 py-[7px] text-left text-muted-foreground"
          >
            <Search size={15} aria-hidden="true" />
            <span className="flex-1">Szukaj…</span>
            <span className="rounded border border-input px-[5px] font-mono text-[11px]">
              ⌘K
            </span>
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Wkrótce</TooltipContent>
      </Tooltip>

      <MonoLabel className="px-2 py-1.5">Moduły</MonoLabel>
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
              <div {...celKonca} className="flex items-center justify-between px-2 pt-3.5 pb-1.5">
                <MonoLabel>{nazwa}</MonoLabel>
                {nazwa === "Strony" && (
                  <button
                    type="button"
                    aria-label="Dodaj stronę"
                    onClick={nowaStrona}
                    className="flex cursor-pointer p-0.5 text-muted-foreground hover:text-foreground"
                  >
                    <Plus size={15} aria-hidden="true" />
                  </button>
                )}
              </div>
              {lista.map((strona) => {
                const href = `/strony/${strona.id}`;
                const tytul = strona.title.trim() === "" ? "Bez tytułu" : strona.title;
                return (
                  <div
                    key={strona.id}
                    className={cn(
                      "group relative rounded-md",
                      // Linia wskaźnika upuszczenia 2 px nad albo pod wierszem, przeciągana strona przygaszona
                      nad?.typ === "wiersz" &&
                        nad.id === strona.id &&
                        przeciagana !== strona.id &&
                        (nad.po ? "shadow-[inset_0_-2px_0_#171717]" : "shadow-[inset_0_2px_0_#171717]"),
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
                      <div className={cn(POZYCJA, "bg-white")}>
                        <PageIcon icon={strona.icon} size={16} />
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
                          className="min-w-0 flex-1 rounded border border-primary bg-white px-1.5 py-0.5 text-sm text-foreground outline-none"
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
                      <div className="absolute top-1/2 right-1 -translate-y-1/2">
                        <PageMenu
                          page={strona}
                          pages={strony}
                          store={store}
                          onRename={() => {
                            zakonczono.current = false;
                            setSzkic(strona.title);
                            setEdytowana(strona.id);
                          }}
                          triggerClassName="flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent font-mono text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-border focus-visible:opacity-100 data-[state=open]:opacity-100"
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
                      "mx-1 rounded-md border border-dashed px-2 py-2 text-center text-xs text-muted-foreground",
                      koniecAktywny ? "border-primary bg-muted" : "border-border-strong",
                    )}
                  >
                    Upuść tutaj, aby dodać do ulubionych
                  </div>
                ) : (
                  <div
                    {...celKonca}
                    data-testid={`koniec-${ulubione ? "ulubione" : "strony"}`}
                    className={cn("h-3 rounded-md", koniecAktywny && "shadow-[inset_0_2px_0_#171717]")}
                  />
                ))}
            </React.Fragment>
          );
        })}
      </div>
      <button
        type="button"
        onClick={nowaStrona}
        className={cn(POZYCJA, "cursor-pointer text-left text-muted-foreground hover:bg-muted hover:text-foreground")}
      >
        <Plus size={16} aria-hidden="true" />
        Nowa strona
      </button>

      <div className="min-h-6 flex-1" />
      <Link
        href="/ustawienia"
        aria-current={aktywna("/ustawienia") ? "page" : undefined}
        className={klasaPozycji("/ustawienia")}
      >
        <Settings size={16} aria-hidden="true" />
        Ustawienia
      </Link>
      <div className="mt-1.5 border-t border-border pt-1">
        <AccountPopover user={user} />
      </div>
    </nav>
  );
}
