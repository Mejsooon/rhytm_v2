// Generuje ikony PWA (PNG) z logo rhytm: siatka 3×3 kwadratów, jak w src/components/brand/rhytm-logo.tsx.
// Uruchom: node scripts/make-icons.mjs
import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const KATALOG_WYJSCIOWY = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");

const CIEMNY = "#171717";
const AKCENT = "#15803d";

// Te same wartości co w komponencie RhytmLogo (viewBox 0 0 48 48)
const KWADRATY = [
  { x: 4, y: 4, opacity: 1 },
  { x: 18, y: 4, opacity: 0.55 },
  { x: 32, y: 4, opacity: 0.25 },
  { x: 4, y: 18, opacity: 0.55 },
  { x: 18, y: 18, opacity: 0.25 },
  { x: 32, y: 18, opacity: 1, accent: true },
  { x: 4, y: 32, opacity: 0.25 },
  { x: 18, y: 32, opacity: 1 },
  { x: 32, y: 32, opacity: 0.55 },
];

// Zwraca SVG o rozmiarze `rozmiar` px: biały tło i logo wycentrowane, zajmujące `udzial` szerokości
function svgIkony(rozmiar, udzial) {
  const logo = rozmiar * udzial;
  const przesuniecie = (rozmiar - logo) / 2;
  const kwadraty = KWADRATY.map(
    (k) =>
      `<rect x="${k.x}" y="${k.y}" width="11" height="11" rx="3" fill="${k.accent ? AKCENT : CIEMNY}" opacity="${k.opacity}"/>`,
  ).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${rozmiar}" height="${rozmiar}" viewBox="0 0 ${rozmiar} ${rozmiar}">
  <rect width="${rozmiar}" height="${rozmiar}" fill="#ffffff"/>
  <svg x="${przesuniecie}" y="${przesuniecie}" width="${logo}" height="${logo}" viewBox="0 0 48 48">${kwadraty}</svg>
</svg>`;
}

// Lista plików: zwykłe ikony logo na 75% płótna, maskable na 60% (20% marginesu z każdej strony)
const PLIKI = [
  { nazwa: "icon-192.png", rozmiar: 192, udzial: 0.75 },
  { nazwa: "icon-512.png", rozmiar: 512, udzial: 0.75 },
  { nazwa: "maskable-512.png", rozmiar: 512, udzial: 0.6 },
  { nazwa: "apple-touch-icon.png", rozmiar: 180, udzial: 0.75 },
];

mkdirSync(KATALOG_WYJSCIOWY, { recursive: true });

for (const { nazwa, rozmiar, udzial } of PLIKI) {
  const svg = svgIkony(rozmiar, udzial);
  await sharp(Buffer.from(svg)).png().toFile(path.join(KATALOG_WYJSCIOWY, nazwa));
  console.log(`Zapisano ${nazwa} (${rozmiar}px)`);
}
