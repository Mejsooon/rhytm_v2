"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Plus, Search, Settings } from "lucide-react";
import { toast } from "sonner";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { MonoLabel } from "@/components/controls";
import { createBlankPage } from "@/features/pages/actions";
import type { PageSummary } from "@/features/pages/load-pages";
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

const BLAD_ZAPISU = "Nie udało się zapisać. Spróbuj ponownie.";

// Sidebar web (Sidebar.dc.html): 232 px, przyklejony do góry, poniżej 800 px ukryty (jest TabBar).
// Strony: kolejność z `position`, przeciąganie zmienia kolejność, F2 zmienia nazwę aktywnej,
// „⋯” otwiera menu strony (PageMenu). Pusty tytuł wyświetla się jako „Bez tytułu”.
export function AppSidebar({
  user,
  pages = [],
}: {
  user: SidebarUser;
  pages?: PageSummary[];
}) {
  const sciezka = usePathname();
  const router = useRouter();
  const store = usePagesStore(pages);
  const strony = store.pages;

  const [edytowana, setEdytowana] = React.useState<string | null>(null);
  const [szkic, setSzkic] = React.useState("");
  // Esc i Enter kończą edycję same; flaga blokuje drugi zapis z onBlur przy odmontowaniu pola
  const zakonczono = React.useRef(false);
  const [przeciagana, setPrzeciagana] = React.useState<string | null>(null);
  const [nad, setNad] = React.useState<string | null>(null);
  const tworzenie = React.useRef(false);

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

  async function nowaStrona() {
    if (tworzenie.current) return;
    tworzenie.current = true;
    let wynik: Awaited<ReturnType<typeof createBlankPage>> | null = null;
    try {
      wynik = await createBlankPage();
    } catch {
      wynik = null;
    }
    tworzenie.current = false;
    if (!wynik || !wynik.ok) {
      toast.error(BLAD_ZAPISU);
      return;
    }
    router.push(`/strony/${wynik.id}`);
  }

  function zapiszNazwe(strona: PageSummary) {
    if (zakonczono.current) return;
    zakonczono.current = true;
    setEdytowana(null);
    const nowa = szkic.trim();
    if (nowa !== strona.title.trim()) void store.rename(strona.id, nowa);
  }

  function upusc(celId: string) {
    const zrodloId = przeciagana;
    setPrzeciagana(null);
    setNad(null);
    if (zrodloId === null || zrodloId === celId) return;
    const ids = strony.map((s) => s.id);
    const z = ids.indexOf(zrodloId);
    const d = ids.indexOf(celId);
    if (z < 0 || d < 0) return;
    ids.splice(d, 0, ids.splice(z, 1)[0]);
    void store.reorder(ids);
  }

  const aktywna = (href: string) =>
    sciezka === href || sciezka.startsWith(`${href}/`);
  const klasaPozycji = (href: string) =>
    cn(
      POZYCJA,
      aktywna(href)
        ? "bg-[#f0f0f0] font-medium text-[#171717]"
        : "text-[#666666] hover:bg-[#f5f5f5] hover:text-[#171717]",
    );

  return (
    <nav
      aria-label="Główna nawigacja"
      className="sticky top-0 hidden h-dvh w-[232px] flex-none flex-col gap-0.5 overflow-y-auto border-r border-[#eaeaea] bg-[#fafafa] px-2.5 py-3 text-sm text-[#171717] min-[800px]:flex"
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
            className="mt-0.5 mb-2.5 flex cursor-default items-center gap-2 rounded-md border border-[#eaeaea] bg-white px-2.5 py-[7px] text-left text-[#666666]"
          >
            <Search size={15} aria-hidden="true" />
            <span className="flex-1">Szukaj…</span>
            <span className="rounded border border-[#e0e0e0] px-[5px] font-mono text-[11px]">
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

      <div className="flex items-center justify-between px-2 pt-3.5 pb-1.5">
        <MonoLabel>Strony</MonoLabel>
        <button
          type="button"
          aria-label="Dodaj stronę"
          onClick={nowaStrona}
          className="flex cursor-pointer p-0.5 text-[#666666] hover:text-[#171717]"
        >
          <Plus size={15} aria-hidden="true" />
        </button>
      </div>
      {strony.map((strona) => {
        const href = `/strony/${strona.id}`;
        const tytul = strona.title.trim() === "" ? "Bez tytułu" : strona.title;
        return (
          <div
            key={strona.id}
            className={cn(
              "group relative rounded-md",
              nad === strona.id && przeciagana !== strona.id && "shadow-[inset_0_2px_0_#171717]",
              przeciagana === strona.id && "opacity-50",
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
              if (nad !== strona.id) setNad(strona.id);
            }}
            onDrop={(e) => {
              e.preventDefault();
              upusc(strona.id);
            }}
            onDragEnd={() => {
              setPrzeciagana(null);
              setNad(null);
            }}
          >
            {edytowana === strona.id ? (
              <div className={cn(POZYCJA, "bg-white")}>
                <span aria-hidden="true" className="w-4 flex-none text-center font-mono text-[#6b6b6b]">
                  {strona.icon}
                </span>
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
                  className="min-w-0 flex-1 rounded border border-[#171717] bg-white px-1.5 py-0.5 text-sm text-[#171717] outline-none"
                />
              </div>
            ) : (
              <Link
                href={href}
                draggable
                aria-current={aktywna(href) ? "page" : undefined}
                className={cn(klasaPozycji(href), "pr-8")}
              >
                <span aria-hidden="true" className="w-4 flex-none text-center font-mono text-[#6b6b6b]">
                  {strona.icon}
                </span>
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
                  triggerClassName="flex size-6 cursor-pointer items-center justify-center rounded border-0 bg-transparent font-mono text-[#666666] opacity-0 group-hover:opacity-100 hover:bg-[#ebebeb] focus-visible:opacity-100 data-[state=open]:opacity-100"
                />
              </div>
            )}
          </div>
        );
      })}
      <button
        type="button"
        onClick={nowaStrona}
        className={cn(POZYCJA, "cursor-pointer text-left text-[#6b6b6b] hover:bg-[#f5f5f5] hover:text-[#171717]")}
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
      <div className="mt-1.5 border-t border-[#eaeaea] pt-1">
        <AccountPopover user={user} />
      </div>
    </nav>
  );
}
