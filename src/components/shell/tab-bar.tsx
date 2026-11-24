"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import { TAB_ITEMS } from "./nav-items";

// Dolny pasek telefonu (CMTabBar.dc.html, .tabbar/.tab): 5 pozycji, widoczny tylko poniżej 800 px.
// Wysokość --tabbar-h = 56 px treści + dolny odstęp max(8 px, safe-area) (w makiecie 64 px);
// w poziomie omija boczne wcięcia (notch) przez safe-area.
// Aktywna pozycja wynika z prefiksu trasy (href albo alsoActive z TAB_ITEMS, np. /hasla → „Strony”).
export function TabBar() {
  const sciezka = usePathname();

  return (
    <nav
      aria-label="Moduły"
      className="fixed inset-x-0 bottom-0 z-40 grid h-(--tabbar-h) grid-cols-5 gap-0.5 border-t border-sidebar-border bg-sidebar pt-1.5 pr-[max(6px,env(safe-area-inset-right))] pl-[max(6px,env(safe-area-inset-left))] pb-[max(8px,env(safe-area-inset-bottom))] text-[11px] text-foreground min-[800px]:hidden"
    >
      {TAB_ITEMS.map(({ key, label, href, icon: Ikona, alsoActive = [] }) => {
        const aktywna = [href, ...alsoActive].some(
          (prefiks) => sciezka === prefiks || sciezka.startsWith(`${prefiks}/`),
        );
        return (
          <Link
            key={key}
            href={href}
            aria-current={aktywna ? "page" : undefined}
            className={cn(
              "flex min-h-11 flex-col items-center justify-center gap-[3px] rounded-[8px] font-medium no-underline",
              aktywna
                ? "bg-black/5 text-foreground"
                : "text-[rgba(38,38,38,.68)] hover:bg-black/4 hover:text-foreground",
            )}
          >
            <Ikona size={20} strokeWidth={2} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
