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

// Kolor paska przeglądarki zgodny z tłem aplikacji
export const viewport: Viewport = {
  themeColor: "#ffffff",
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
