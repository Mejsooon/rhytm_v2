import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
