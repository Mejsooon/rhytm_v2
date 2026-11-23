import {
  Activity,
  Calendar,
  Lock,
  Sun,
  SquareCheck,
  Table,
  type LucideIcon,
} from "lucide-react";

export type ModuleKey = "dzis" | "kalendarz" | "sport" | "nawyki" | "hasla";
// Dolny pasek telefonu nie ma Haseł: moduł jest na górze listy stron (MPages)
export type TabKey = Exclude<ModuleKey, "hasla"> | "strony";

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
  // Moduł Hasła (S2Sidebar.dc.html): po „Nawykach i śnie”
  { key: "hasla", label: "Hasła", href: "/hasla", icon: Lock },
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
