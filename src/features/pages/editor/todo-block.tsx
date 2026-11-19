"use client";

import * as React from "react";

import { Checkbox } from "@/components/controls";

// Pozycja listy zadań: checkbox zapisuje {text, done} od razu, tekst po utracie fokusu
export function TodoBlock({
  text,
  done,
  onSave,
}: {
  text: string;
  done: boolean;
  onSave: (content: { text: string; done: boolean }) => void;
}) {
  const [wartosc, setWartosc] = React.useState(text);
  const [zrodlo, setZrodlo] = React.useState(text);
  if (zrodlo !== text) {
    setZrodlo(text);
    setWartosc(text);
  }

  return (
    <div className="flex items-center gap-2.5 py-[3px] max-[799px]:min-h-11">
      {/* Na telefonie pole 24 px dostaje obszar dotyku 44 px (przezroczysty przycisk nad checkboxem) */}
      <span className="relative inline-flex">
        <Checkbox
          checked={done}
          ariaLabel="Zrobione"
          onChange={(v) => onSave({ text: wartosc, done: v })}
        />
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="todo-hit"
          onClick={() => onSave({ text: wartosc, done: !done })}
          className="absolute top-1/2 left-1/2 hidden size-11 -translate-x-1/2 -translate-y-1/2 cursor-pointer border-0 bg-transparent p-0 max-[799px]:block"
        />
      </span>
      <input
        type="text"
        value={wartosc}
        onChange={(e) => setWartosc(e.target.value)}
        onBlur={() => {
          if (wartosc !== text) onSave({ text: wartosc, done });
        }}
        placeholder="Zadanie"
        aria-label="Zadanie"
        className={`min-w-0 flex-1 border-0 bg-transparent p-0 font-[inherit] outline-none placeholder:text-[#a3a3a3] ${
          done ? "text-[#a3a3a3] line-through" : "text-[#171717]"
        }`}
      />
    </div>
  );
}
