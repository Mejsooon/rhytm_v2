// Zamienia klasy Tailwind z hexami UI i promieniami w px na tokeny COSS.
// Użycie: node scripts/coss-kolory.mjs [--check]
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// hex -> { text, bg, border, ring } (undefined = klasa zostaje bez zmian)
const wiersze = [
  [["#171717", "#000000"], { text: "foreground", bg: "primary", border: "primary", ring: "ring" }],
  [["#2e2e2e"], { text: "foreground", bg: "primary-hover", border: "primary" }],
  [["#404040", "#525252", "#555555"], { text: "soft-foreground", border: "border-strong" }],
  [["#666666", "#666", "#6b6b6b", "#737373", "#7a7a7a"], { text: "muted-foreground", bg: "muted-foreground", border: "border-strong" }],
  [["#8a8a8a", "#a3a3a3", "#b0b0b0", "#b5b5b5", "#c4c4c4"], { text: "faint-foreground", bg: "faint-foreground", border: "ring" }],
  [["#cfcfcf", "#d4d4d4", "#d9d9d9"], { text: "faint-foreground", bg: "border-strong", border: "border-strong" }],
  [["#e0e0e0", "#e5e5e5"], { text: "faint-foreground", bg: "input", border: "input" }],
  [["#eaeaea", "#ebebeb", "#efefef"], { bg: "border", border: "border" }],
  [["#f0f0f0"], { bg: "active", border: "border" }],
  [["#f2f2f2", "#f4f4f5", "#f5f5f5"], { bg: "muted", border: "border" }],
  [["#fafafa", "#fcfcfc"], { text: "primary-foreground", bg: "panel", border: "border" }],
  [["#b91c1c"], { text: "destructive-foreground", bg: "destructive", border: "destructive" }],
  [["#991b1b"], { text: "destructive-foreground", bg: "destructive-hover", border: "destructive" }],
  [["#fef2f2", "#fee2e2", "#fecaca", "#f3c7c7"], { bg: "destructive-soft", border: "destructive-border" }],
  [["#15803d"], { text: "success", bg: "success", border: "success" }],
  [["#f0faf4", "#f0fdf4", "#f7fbf8", "#bbe5cc"], { bg: "success-soft", border: "success-border" }],
  [["#c2410c"], { text: "warning-foreground", bg: "warning", border: "warning" }],
  [["#fff4ed", "#fed7aa"], { bg: "warning-soft", border: "warning-border" }],
  [["#0070f3"], { text: "info-foreground", bg: "info", border: "info" }],
  [["#eef5ff", "#cfe2ff"], { bg: "info-soft", border: "info-border" }],
];
export const MAPA = {};
for (const [hexy, kolumny] of wiersze) for (const h of hexy) MAPA[h] = kolumny;

const KOLUMNA = {
  text: "text", fill: "text", stroke: "text", placeholder: "text", caret: "text", decoration: "text",
  bg: "bg",
  border: "border", divide: "border",
  ring: "ringcol", outline: "ringcol",
};
const PROMIEN = { "6": "sm", "10": "md", "12": "lg", "16": "xl" };

// znak należący do tokenu klasy: nie biały znak, nie cudzysłów, nie backtick
const ZNAK = "[^\\s\"'\u0060]";
const RE_HEX = new RegExp(
  String.raw`(?<!${ZNAK})((?:${ZNAK}*:)?)(!?)(text|bg|border|divide|ring|outline|fill|stroke|decoration|placeholder|caret)-((?:t|b|l|r|x|y|s|e)-)?\[(#[0-9a-fA-F]{3,6})\](\/\d+)?(?![\w\[\]/#-])`,
  "g",
);
const RE_PROMIEN = new RegExp(
  String.raw`(?<!${ZNAK})((?:${ZNAK}*:)?)(!?)rounded((?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?)-\[(\d+)px\](?![\w\[\]/#-])`,
  "g",
);

// Hex w dowolnej wartości arbitralnej (np. shadow-[0_0_0_2px_#fff]) — tylko wykrywamy, nie mapujemy
export const RE_HEX_ARB = new RegExp(
  String.raw`(?<!${ZNAK})${ZNAK}*-\[[^\]\s"'\u0060]*#[0-9a-fA-F]{3,8}(?![0-9a-zA-Z])[^\]\s"'\u0060]*\]`,
  "g",
);

export function mapSource(src) {
  return src
    .replace(RE_HEX, (cale, warianty, wykrz, prefiks, strona = "", hex, alfa = "") => {
      const wiersz = MAPA[hex.toLowerCase()];
      if (!wiersz) return cale;
      const kol = KOLUMNA[prefiks];
      let token;
      if (kol === "ringcol") {
        token = ["#171717", "#000000"].includes(hex.toLowerCase()) ? "ring" : wiersz.border;
      } else {
        token = wiersz[kol];
      }
      if (!token) return cale;
      return `${warianty}${wykrz}${prefiks}-${strona}${token}${alfa}`;
    })
    .replace(RE_PROMIEN, (cale, warianty, wykrz, strona, px) => {
      const t = PROMIEN[px];
      return t ? `${warianty}${wykrz}rounded${strona}-${t}` : cale;
    });
}

export function mapClass(cls) {
  return mapSource(cls);
}

function pliki(dir, wynik = []) {
  for (const nazwa of readdirSync(dir)) {
    const sciezka = join(dir, nazwa);
    if (statSync(sciezka).isDirectory()) pliki(sciezka, wynik);
    else if (/\.(ts|tsx)$/.test(nazwa)) wynik.push(sciezka);
  }
  return wynik;
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const sprawdz = process.argv.includes("--check");
  const korzen = join(fileURLToPath(import.meta.url), "..", "..", "src");
  let zmienione = 0;
  const pozostalosci = [];
  for (const plik of pliki(korzen)) {
    const zrodlo = readFileSync(plik, "utf8");
    if (!sprawdz) {
      const nowe = mapSource(zrodlo);
      if (nowe !== zrodlo) {
        writeFileSync(plik, nowe);
        zmienione++;
      }
    }
    const biezace = sprawdz ? zrodlo : mapSource(zrodlo);
    for (const m of biezace.matchAll(RE_HEX)) pozostalosci.push(`${plik}: ${m[0]}`);
    // wartości arbitralne z hexem; pomijamy te, które już wypisał RE_HEX
    for (const m of biezace.matchAll(RE_HEX_ARB)) {
      if (!new RegExp(RE_HEX.source).test(m[0])) pozostalosci.push(`${plik}: ${m[0]}`);
    }
  }
  if (!sprawdz) console.log(`Zmienione pliki: ${zmienione}`);
  if (sprawdz) {
    for (const l of pozostalosci) console.log(l);
    if (pozostalosci.length) process.exit(1);
  }
}
