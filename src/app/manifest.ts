import type { MetadataRoute } from "next";

// Manifest PWA: nazwa, ekran startowy i ikony instalowanej aplikacji
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "rhytm",
    short_name: "rhytm",
    lang: "pl",
    start_url: "/dzis",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      // Ikona maskable: logo mieści się w bezpiecznym obszarze (20% marginesu)
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
