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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:bg-black/40 max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          aria-describedby={undefined}
          className={`fixed z-50 flex flex-col bg-white text-sm text-foreground outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:max-h-[calc(100%-64px)] ${wide ? "min-[800px]:w-[min(560px,calc(100%-32px))]" : "min-[800px]:w-[min(460px,calc(100%-32px))]"} min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 rounded-xl bg-clip-padding min-[800px]:border min-[800px]:border-border min-[800px]:shadow-pop max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:max-h-[92%] max-[799px]:rounded-t-[18px] max-[799px]:rounded-b-none max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]`}
        >
          {/* Uchwyt arkusza — tylko na telefonie */}
          <div
            aria-hidden="true"
            className="mx-auto mt-2 mb-0.5 h-[5px] w-9 flex-none rounded-[3px] bg-border-strong min-[800px]:hidden"
          />
          <div className="flex flex-none items-start justify-between gap-3 px-6 pt-6 pb-4 max-[799px]:relative max-[799px]:justify-center max-[799px]:border-b max-[799px]:border-border max-[799px]:px-2 max-[799px]:pt-1 max-[799px]:pb-1">
            <div>
              <Dialog.Title className="m-0 text-lg leading-[1.3] font-semibold max-[799px]:flex max-[799px]:h-11 max-[799px]:items-center max-[799px]:text-base">
                {title}
              </Dialog.Title>
              {description && (
                <p className="m-0 mt-1 text-sm text-muted-foreground max-[799px]:hidden">
                  {description}
                </p>
              )}
            </div>
            <Dialog.Close
              aria-label="Zamknij"
              className="inline-flex size-[30px] flex-none cursor-pointer items-center justify-center rounded-md border border-input bg-white text-muted-foreground outline-none hover:bg-muted focus-visible:shadow-focus max-[799px]:hidden"
            >
              ✕
            </Dialog.Close>
            {headerAction && (
              <div className="flex-none max-[799px]:absolute max-[799px]:top-1 max-[799px]:right-2">
                {headerAction}
              </div>
            )}
          </div>
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5 max-[799px]:pt-4 max-[799px]:pb-7">
            {children}
          </div>
          {footer && (
            <div className="flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border bg-black/[.025] px-6 py-4 min-[800px]:rounded-b-[15px]">
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
