"use client";

import * as React from "react";
import { Dialog } from "radix-ui";

// Okno wg VaultReset.dc.html (od 800 px, na środku) i arkusz wg MBlockSheet.dc.html
// (poniżej 800 px, od dołu z uchwytem). Przełączanie wyłącznie klasami CSS.
export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  children,
  footer,
  headerAction,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  // Podtytuł pod tytułem (BlockDialog, ScopeDialog, CategoryDialog)
  description?: string;
  // Szersze okno 560 px (BlockDialog.dc.html) zamiast 460 px
  wide?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  // Przycisk w nagłówku po prawej (telefon: np. „Gotowe” w arkuszu „Kolumna”)
  headerAction?: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/25 max-[799px]:bg-black/40" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed z-50 flex flex-col bg-white text-sm text-[#171717] outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:max-h-[calc(100%-64px)] ${wide ? "min-[800px]:w-[min(560px,calc(100%-32px))]" : "min-[800px]:w-[min(460px,calc(100%-32px))]"} min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 min-[800px]:rounded-xl min-[800px]:border min-[800px]:border-[#e0e0e0] min-[800px]:shadow-[0_16px_48px_rgba(0,0,0,.16)] max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:max-h-[92%] max-[799px]:rounded-t-[18px] max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]`}
        >
          {/* Uchwyt arkusza — tylko na telefonie */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-[#d4d4d4] min-[800px]:hidden"
          />
          <div className="flex flex-none items-start justify-between gap-3 px-5 pt-[18px] pb-3.5 max-[799px]:relative max-[799px]:justify-center max-[799px]:border-b max-[799px]:border-[#f0f0f0] max-[799px]:px-2 max-[799px]:pt-1 max-[799px]:pb-1">
            <div>
              <Dialog.Title className="m-0 text-[17px] font-semibold max-[799px]:flex max-[799px]:h-11 max-[799px]:items-center max-[799px]:text-base">
                {title}
              </Dialog.Title>
              {description && (
                <p className="m-0 mt-1 text-[13px] text-[#666666] max-[799px]:hidden">
                  {description}
                </p>
              )}
            </div>
            <Dialog.Close
              aria-label="Zamknij"
              className="inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md border border-[#e0e0e0] bg-white text-[#666666] outline-none focus-visible:ring-2 focus-visible:ring-[#171717]/20 max-[799px]:hidden"
            >
              ✕
            </Dialog.Close>
            {headerAction && (
              <div className="flex-none max-[799px]:absolute max-[799px]:top-1 max-[799px]:right-2">
                {headerAction}
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 pb-[18px] max-[799px]:pt-4 max-[799px]:pb-7">
            {children}
          </div>
          {footer && (
            <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-[#eaeaea] bg-[#fafafa] px-5 py-3 min-[800px]:rounded-b-xl">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
