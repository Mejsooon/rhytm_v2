"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/controls";
import { useSidebarState } from "./sidebar-state";

// Przyciski schowania/pokazania paska bocznego (tylko web, na telefonie ukryte):
// - sidebar: ghost xs obok „rhytm” (S2Sidebar),
// - rail: przycisk 36 px w schowanym pasku pod logo (S2SidebarCollapsed, .rail button).
export function SidebarToggle({ placement }: { placement: "sidebar" | "rail" }) {
  const { toggle } = useSidebarState();
  // Skrót w podpowiedzi zależy od systemu; na serwerze Ctrl, żeby HTML się zgadzał (po hydratacji ⌘ na Macu)
  const mac = React.useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const skrot = mac ? "⌘+\\" : "Ctrl+\\";

  const etykieta = placement === "sidebar" ? "Schowaj pasek boczny" : "Pokaż pasek boczny";
  const Ikona = placement === "sidebar" ? PanelLeftClose : PanelLeftOpen;
  if (placement === "rail") {
    return (
      <button
        type="button"
        aria-label={etykieta}
        title={`${etykieta} · ${skrot}`}
        onClick={toggle}
        // .rail button: 36 px, promień 8 px, kolor rgba(38,38,38,.68), najechanie tło 4%
        className="grid size-9 cursor-pointer place-items-center rounded-[8px] border-0 bg-transparent p-0 text-[rgba(38,38,38,.68)] outline-none hover:bg-black/[.04] hover:text-foreground focus-visible:shadow-focus"
      >
        <Ikona size={16} aria-hidden="true" />
      </button>
    );
  }
  return (
    <Button
      variant="ghost"
      size="xs"
      icon
      aria-label={etykieta}
      // Podpowiedź jak w makiecie: „Schowaj pasek boczny · Ctrl+\”
      title={`${etykieta} · ${skrot}`}
      onClick={toggle}
      // Szara ikona (#686868), przycisk wysunięty 4 px w prawo jak w S2Sidebar
      className="-mr-1 text-muted-foreground max-[799px]:hidden"
    >
      <Ikona size={16} aria-hidden="true" />
    </Button>
  );
}
