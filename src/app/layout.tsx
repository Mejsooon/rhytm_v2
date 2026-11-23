import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import "@fontsource-variable/inter";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "rhytm",
  description: "Organizer życia",
  // Ikona na ekranie głównym iOS
  icons: {
    apple: "/icons/apple-touch-icon.png",
  },
  // Tryb aplikacji po dodaniu do ekranu głównego na iOS
  appleWebApp: {
    capable: true,
    title: "rhytm",
    statusBarStyle: "default",
  },
};

// Kolor paska przeglądarki zgodny z tłem aplikacji.
// viewport-fit=cover: bez tego env(safe-area-inset-*) zawsze daje 0, więc dolny pasek nie
// odsuwałby się od paska gestów iPhone'a. Górnego wcięcia nie potrzeba: statusBarStyle „default”
// zostawia pasek stanu nad stroną (treść nie wchodzi pod niego ani pod notch).
export const viewport: Viewport = {
  themeColor: "#ffffff",
  viewportFit: "cover",
};

// Wykonuje się przed pierwszym malowaniem: zaznacza na <html>, że pasek boczny jest schowany,
// żeby szkielet paska (fallback Suspense) nie mignął na przeładowaniu. Prawdziwy stan czyta AppShell.
const SKRYPT_PASKA =
  'if(/(?:^|; )rhytm_sidebar=collapsed/.test(document.cookie))document.documentElement.dataset.sidebar="collapsed"';

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      // Skrypt poniżej dopisuje data-sidebar przed hydratacją
      suppressHydrationWarning
      className={`${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: SKRYPT_PASKA }} />
        {children}
        {/* Jedno miejsce na powiadomienia (toast) w całej aplikacji */}
        <Toaster />
      </body>
    </html>
  );
}
