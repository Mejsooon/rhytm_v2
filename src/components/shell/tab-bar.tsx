"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { TAB_ITEMS } from "./nav-items";

// Dolny pasek telefonu (MTabBar.dc.html): 56 px treści + odstęp max(8 px, safe-area), razem --tabbar-h;
// 5 pozycji, widoczny tylko poniżej 800 px.
// Aktywna pozycja wynika z prefiksu trasy.
export function TabBar() {
  const sciezka = usePathname();

  return (
    <nav
      aria-label="Moduły"
      className="fixed inset-x-0 bottom-0 z-40 grid h-(--tabbar-h) grid-cols-5 border-t border-[#eaeaea] bg-[#fafafa]/95 px-1 pt-1.5 pb-[max(8px,env(safe-area-inset-bottom))] min-[800px]:hidden"
    >
      {TAB_ITEMS.map(({ key, label, href, icon: Ikona }) => {
        const aktywna = sciezka === href || sciezka.startsWith(`${href}/`);
        return (
          <Link
            key={key}
            href={href}
            aria-current={aktywna ? "page" : undefined}
            className={cn(
              "flex flex-col items-center justify-center gap-[3px] rounded-[10px] text-[11px] no-underline",
              aktywna ? "font-semibold text-[#171717]" : "text-[#7a7a7a]",
            )}
          >
            <Ikona size={22} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
