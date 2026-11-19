import {
  Activity,
  BookOpen,
  Bookmark,
  Briefcase,
  Calendar,
  Camera,
  Car,
  CheckSquare,
  Code,
  Coffee,
  Dumbbell,
  FileText,
  Film,
  Flag,
  Flame,
  Folder,
  Globe,
  GraduationCap,
  Heart,
  Home,
  Key,
  Leaf,
  Lightbulb,
  Lock,
  Moon,
  Music,
  Plane,
  Rocket,
  ShoppingCart,
  Smile,
  Star,
  Sun,
  Table,
  Target,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from "lucide-react";

import { ICON_COLORS, parsePageIcon, type IconName } from "./page-icons";

const IKONY: Record<IconName, LucideIcon> = {
  table: Table,
  "book-open": BookOpen,
  bookmark: Bookmark,
  "file-text": FileText,
  folder: Folder,
  briefcase: Briefcase,
  code: Code,
  globe: Globe,
  rocket: Rocket,
  target: Target,
  lightbulb: Lightbulb,
  "graduation-cap": GraduationCap,
  calendar: Calendar,
  "check-square": CheckSquare,
  star: Star,
  heart: Heart,
  dumbbell: Dumbbell,
  activity: Activity,
  moon: Moon,
  sun: Sun,
  leaf: Leaf,
  flame: Flame,
  zap: Zap,
  coffee: Coffee,
  film: Film,
  music: Music,
  camera: Camera,
  plane: Plane,
  home: Home,
  car: Car,
  wallet: Wallet,
  "shopping-cart": ShoppingCart,
  lock: Lock,
  key: Key,
  users: Users,
  smile: Smile,
  flag: Flag,
};

// Ikona strony (PageIcon.dc.html): emoji albo ikona liniowa w kolorze. Brak ikony (albo stary
// znaczek spoza formatu) → domyślna tabela lub kłódka w kolorze tekstu wokół.
export function PageIcon({
  icon,
  size = 16,
  fallback = "table",
}: {
  icon: string;
  size?: number;
  // "lock" na razie nieużywane — dla strony Passwords (Etap 8), której TemplateKey jeszcze nie zna
  fallback?: "table" | "lock";
}) {
  const ikona = parsePageIcon(icon);
  const Ikona = ikona?.kind === "icon" ? IKONY[ikona.v] : fallback === "lock" ? Lock : Table;
  const kolor =
    ikona?.kind === "icon" ? ICON_COLORS.find((k) => k.key === ikona.color)?.hex : "currentColor";

  return (
    <span
      aria-hidden="true"
      data-page-icon={ikona?.kind === "emoji" ? ikona.v : ikona?.kind === "icon" ? `${ikona.v}:${ikona.color}` : fallback}
      className="inline-flex flex-none items-center justify-center"
      style={{ width: size, height: size }}
    >
      {ikona?.kind === "emoji" ? (
        <span
          style={{
            fontSize: Math.round(size * 0.95),
            lineHeight: `${size}px`,
            fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif',
          }}
        >
          {ikona.v}
        </span>
      ) : (
        <Ikona size={size} strokeWidth={2} color={kolor} className="block" />
      )}
    </span>
  );
}
