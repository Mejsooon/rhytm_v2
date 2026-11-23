"use client";

import * as React from "react";

type StanPaska = { collapsed: boolean; toggle: () => void };

// Bez providera (np. testy pojedynczych widoków) pasek jest rozwinięty, a przełącznik nic nie robi
const KontekstPaska = React.createContext<StanPaska>({
  collapsed: false,
  toggle: () => {},
});

export function useSidebarState(): StanPaska {
  return React.useContext(KontekstPaska);
}

// Stan paska bocznego: początkowa wartość z ciasteczka czytanego na serwerze (bez mignięcia po odświeżeniu),
// zmiany zapisują ciasteczko rhytm_sidebar, a skrót Ctrl+\ (⌘+\) przełącza pasek z każdego miejsca.
export function SidebarStateProvider({
  initialCollapsed,
  children,
}: {
  initialCollapsed: boolean;
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = React.useState(initialCollapsed);
  const collapsedRef = React.useRef(initialCollapsed);

  // Ciasteczko zapisujemy poza updaterem stanu (updater ma być czysty)
  const toggle = React.useCallback(() => {
    const nowy = !collapsedRef.current;
    collapsedRef.current = nowy;
    document.cookie = `rhytm_sidebar=${nowy ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.dataset.sidebar = nowy ? "collapsed" : "open";
    setCollapsed(nowy);
  }, []);

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        // Przytrzymany skrót nie ma migać paskiem w kółko
        if (e.repeat) {
          e.preventDefault();
          return;
        }
        // Także w polu tekstowym — skrót ma pierwszeństwo, a pole zostaje bez zmian
        e.preventDefault();
        toggle();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggle]);

  const wartosc = React.useMemo(() => ({ collapsed, toggle }), [collapsed, toggle]);
  return <KontekstPaska.Provider value={wartosc}>{children}</KontekstPaska.Provider>;
}
