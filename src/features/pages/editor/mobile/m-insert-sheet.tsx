"use client";

import { X } from "lucide-react";

import { filterSlash, type SlashItem } from "../../blocks";

// Arkusz „Wstaw blok” (MEditor.dc.html): lista pozycji z filtrem z pola poleceń. Bez pułapki fokusu
// (zwykły arkusz, nie modal), żeby pisanie „/tab” w polu pod spodem dalej filtrowało listę.
export function MInsertSheet({
  open,
  query,
  onPick,
  onClose,
}: {
  open: boolean;
  query: string;
  onPick: (item: SlashItem) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  const pozycje = filterSlash(query);

  return (
    <>
      <button
        type="button"
        aria-label="Zamknij menu"
        onClick={onClose}
        className="fixed inset-0 z-50 cursor-pointer border-0 bg-black/40 min-[800px]:hidden"
      />
      <div
        role="dialog"
        aria-label="Wstaw blok"
        className="fixed inset-x-0 bottom-0 z-[51] flex max-h-[92%] flex-col rounded-t-[18px] bg-white shadow-[0_-8px_30px_rgba(0,0,0,.12)] min-[800px]:hidden"
      >
        <div aria-hidden="true" className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-[#d4d4d4]" />
        <div className="flex flex-none items-center py-0.5 pr-2 pl-5">
          <h2 className="m-0 flex-1 text-[17px] font-semibold">Wstaw blok</h2>
          <button
            type="button"
            aria-label="Zamknij"
            onClick={onClose}
            className="inline-flex size-11 cursor-pointer items-center justify-center rounded-[10px] border-0 bg-transparent text-[#171717] hover:bg-[#f5f5f5]"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-3 pb-[30px]">
          {pozycje.map((p, i) => (
            <button
              key={p.type}
              type="button"
              onClick={() => onPick(p)}
              className={`flex min-h-[60px] w-full cursor-pointer items-center gap-3 rounded-xl border-0 p-2 text-left font-[inherit] ${
                i === 0 && query.trim() !== "" ? "bg-[#f2f2f2]" : "bg-transparent"
              }`}
            >
              <span
                aria-hidden="true"
                className="flex size-10 flex-none items-center justify-center rounded-[10px] border border-[#eaeaea] bg-white font-mono"
              >
                {p.icon}
              </span>
              <span className="flex flex-col text-left">
                <span className="font-medium">{p.name}</span>
                <span className="text-[13px] text-[#6b6b6b]">{p.desc}</span>
              </span>
            </button>
          ))}
          {pozycje.length === 0 && (
            <p className="m-0 px-2 py-3 text-[13px] text-[#666666]">Brak bloku „{query.trim()}”</p>
          )}
        </div>
      </div>
    </>
  );
}
