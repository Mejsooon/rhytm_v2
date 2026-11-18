"use client";

import * as React from "react";

export type CardMessage = "idle" | "dirty" | "saved";

// Stan formularza karty: wartości, porównanie z zapisanymi (String() pól, jak makieta) i komunikat stopki
export function useCardForm<T extends Record<string, string | number>>(saved: T) {
  const [zapisane, setZapisane] = React.useState<T>(saved);
  const [value, setValue] = React.useState<T>(saved);
  const [swiezoZapisane, setSwiezoZapisane] = React.useState(false);

  // Next 16 zachowuje stan trasy (Activity), więc nowe zapisane wartości z serwera synchronizujemy jak w categories-card.
  // Porównujemy treść (String() pól), bo serwer przy każdym renderze tworzy nowy obiekt.
  const [poprzednie, setPoprzednie] = React.useState<T>(saved);
  const inneNizPoprzednie = (Object.keys(saved) as (keyof T)[]).some((k) => String(saved[k]) !== String(poprzednie[k]));
  if (inneNizPoprzednie) {
    setPoprzednie(saved);
    setZapisane(saved);
    // Niezapisane zmiany zostają; bez zmian pokazujemy nowe wartości
    const bezZmian = (Object.keys(zapisane) as (keyof T)[]).every((k) => String(value[k]) === String(zapisane[k]));
    if (bezZmian) setValue(saved);
  }

  const dirty = (Object.keys(zapisane) as (keyof T)[]).some((k) => String(value[k]) !== String(zapisane[k]));

  const message: CardMessage = dirty ? "dirty" : swiezoZapisane ? "saved" : "idle";

  return {
    value,
    // Aktualna baza porównania (ostatnio zapisane), a nie surowy props
    saved: zapisane,
    dirty,
    message,
    set(patch: Partial<T>) {
      setValue((v) => ({ ...v, ...patch }));
      setSwiezoZapisane(false);
    },
    reset() {
      setValue(zapisane);
      setSwiezoZapisane(false);
    },
    markSaved(next: T) {
      setZapisane(next);
      setValue(next);
      setSwiezoZapisane(true);
    },
  };
}
