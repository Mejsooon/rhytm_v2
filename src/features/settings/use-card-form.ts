"use client";

import * as React from "react";

export type CardMessage = "idle" | "dirty" | "saved";

// Stan formularza karty: wartości, porównanie z zapisanymi (String() pól, jak makieta) i komunikat stopki
export function useCardForm<T extends Record<string, string | number>>(saved: T) {
  const [zapisane, setZapisane] = React.useState<T>(saved);
  const [value, setValue] = React.useState<T>(saved);
  const [swiezoZapisane, setSwiezoZapisane] = React.useState(false);

  const dirty = (Object.keys(zapisane) as (keyof T)[]).some((k) => String(value[k]) !== String(zapisane[k]));

  const message: CardMessage = dirty ? "dirty" : swiezoZapisane ? "saved" : "idle";

  return {
    value,
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
