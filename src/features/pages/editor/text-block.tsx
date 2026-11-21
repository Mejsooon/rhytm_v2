"use client";

import * as React from "react";

// Akapit i nagłówek edytowane w miejscu (CEmptyPage.dc.html: .ed-in — promień 6 px, fokus: tło .02 i obrys 2 px; 20/600 dla nagłówka).
// Zapis po utracie fokusu, tylko gdy tekst się zmienił.
export function TextBlock({
  variant,
  text,
  onSave,
}: {
  variant: "text" | "heading";
  text: string;
  onSave: (text: string) => void;
}) {
  const [wartosc, setWartosc] = React.useState(text);
  const [zrodlo, setZrodlo] = React.useState(text);
  // Nowa treść z góry (po cofnięciu zapisu albo odświeżeniu danych) zastępuje szkic
  if (zrodlo !== text) {
    setZrodlo(text);
    setWartosc(text);
  }

  function przyUtracieFokusu() {
    if (wartosc !== text) onSave(wartosc);
  }

  if (variant === "heading") {
    return (
      <input
        type="text"
        value={wartosc}
        onChange={(e) => setWartosc(e.target.value)}
        onBlur={przyUtracieFokusu}
        placeholder="Nagłówek"
        aria-label="Nagłówek"
        className="w-full min-w-0 rounded-md border-0 bg-transparent py-1.5 font-[inherit] text-xl font-semibold tracking-[-0.01em] text-foreground outline-none placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-[0_0_0_2px_rgba(38,38,38,.08)]"
      />
    );
  }
  // Akapit rośnie razem z tekstem (field-sizing), żeby długi tekst się zawijał
  return (
    <textarea
      rows={1}
      value={wartosc}
      onChange={(e) => setWartosc(e.target.value)}
      onBlur={przyUtracieFokusu}
      placeholder="Pusty akapit"
      aria-label="Akapit"
      className="block w-full min-w-0 resize-none rounded-md border-0 bg-transparent py-[3px] font-[inherit] leading-[1.6] text-foreground outline-none [field-sizing:content] placeholder:text-faint-foreground focus:bg-black/[.02] focus:shadow-[0_0_0_2px_rgba(38,38,38,.08)]"
    />
  );
}
