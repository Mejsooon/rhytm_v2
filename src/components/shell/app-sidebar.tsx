"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { File, Plus, Search, Settings } from "lucide-react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { MonoLabel } from "@/components/controls";
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
// Etapy 6+ przekażą listę stron w `pages`; teraz jest pusta i widać tylko „Nowa strona”.
export function AppSidebar({
  user,
  pages = [],
}: {
  user: SidebarUser;
  pages?: { id: string; title: string; icon: string }[];
}) {
  const sciezka = usePathname();
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
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label="Dodaj stronę"
              aria-disabled="true"
              className="flex cursor-default p-0.5 text-[#666666]"
            >
              <Plus size={15} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="right">Wkrótce</TooltipContent>
        </Tooltip>
      </div>
      {pages.map((strona) => {
        const href = `/strony/${strona.id}`;
        return (
          <Link
            key={strona.id}
            href={href}
            aria-current={aktywna(href) ? "page" : undefined}
            className={klasaPozycji(href)}
          >
            <File size={16} aria-hidden="true" />
            {strona.title}
          </Link>
        );
      })}
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-disabled="true"
            className={cn(POZYCJA, "cursor-default text-left text-[#6b6b6b]")}
          >
            <Plus size={16} aria-hidden="true" />
            Nowa strona
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">Wkrótce</TooltipContent>
      </Tooltip>

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
