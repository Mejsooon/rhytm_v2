import { AppShell } from "@/components/shell/app-shell";

// Układ aplikacji po zalogowaniu: sidebar (web) / dolny pasek (telefon) + treść modułu
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
