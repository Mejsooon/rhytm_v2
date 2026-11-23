"use client";

import * as React from "react";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { Button } from "@/components/controls";
import { useSidebarState } from "./sidebar-state";

// Przyciski schowania/pokazania paska bocznego (tylko web, na telefonie ukryte):
// - sidebar: ghost xs obok „rhytm” (S2Sidebar),
// - header: ghost sm przed okruszkami, tylko gdy pasek jest schowany (S2SidebarCollapsed).
export function SidebarToggle({ placement }: { placement: "sidebar" | "header" }) {
  const { collapsed, toggle } = useSidebarState();
  // Skrót w podpowiedzi zależy od systemu; na serwerze Ctrl, żeby HTML się zgadzał (po hydratacji ⌘ na Macu)
  const mac = React.useSyncExternalStore(
    () => () => {},
    () => /Mac|iPhone|iPad/.test(navigator.platform),
    () => false,
  );
  const skrot = mac ? "⌘+\\" : "Ctrl+\\";

  if (placement === "header" && !collapsed) return null;

  const etykieta = placement === "sidebar" ? "Schowaj pasek boczny" : "Pokaż pasek boczny";
  const Ikona = placement === "sidebar" ? PanelLeftClose : PanelLeftOpen;
  return (
    <Button
      variant="ghost"
      size={placement === "sidebar" ? "xs" : "sm"}
      icon
      aria-label={etykieta}
      title={`${etykieta} (${skrot})`}
      onClick={toggle}
      className="max-[799px]:hidden"
    >
      <Ikona size={16} aria-hidden="true" />
    </Button>
  );
}
