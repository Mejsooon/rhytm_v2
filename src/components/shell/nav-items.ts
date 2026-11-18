import {
  Activity,
  Calendar,
  Sun,
  SquareCheck,
  Table,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey = "dzis" | "kalendarz" | "sport" | "nawyki";
export type TabKey = ModuleKey | "strony";

// Moduły w sidebarze (web) — ikony i etykiety z Sidebar.dc.html
export const NAV_MODULES: {
  key: ModuleKey;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { key: "dzis", label: "Dziś", href: "/dzis", icon: Sun },
  { key: "kalendarz", label: "Kalendarz", href: "/kalendarz", icon: Calendar },
  { key: "sport", label: "Sport", href: "/sport", icon: Activity },
  { key: "nawyki", label: "Nawyki i sen", href: "/nawyki", icon: SquareCheck },
];

// Pozycje dolnego paska (telefon) — etykiety i ikony z MTabBar.dc.html
export const TAB_ITEMS: {
  key: TabKey;
  label: string;
  href: string;
  icon: LucideIcon;
}[] = [
  { key: "dzis", label: "Dziś", href: "/dzis", icon: Sun },
  { key: "kalendarz", label: "Kalendarz", href: "/kalendarz", icon: Calendar },
  { key: "sport", label: "Sport", href: "/sport", icon: Activity },
  { key: "nawyki", label: "Nawyki", href: "/nawyki", icon: SquareCheck },
  { key: "strony", label: "Strony", href: "/strony", icon: Table },
];
