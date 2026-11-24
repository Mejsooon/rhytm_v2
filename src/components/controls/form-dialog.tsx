"use client";

import * as React from "react";
import { XIcon } from "lucide-react";
import { Dialog } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "./button";

// Okno wg VaultReset.dc.html (od 800 px, na środku) i arkusz wg CMQuickAdd / CMBlockSheet
// (poniżej 800 px, od dołu z uchwytem m-grab). Przełączanie wyłącznie klasami CSS.
// Nagłówek arkusza na telefonie: "close" (CMQuickAdd) = tytuł po lewej + ✕ po prawej;
// "actions" (CMBlockSheet, CMRowEdit) = „Anuluj” · tytuł na środku · przycisk główny.
// Przy "actions" ✕ i stopka są ukryte, więc „Anuluj” i przycisk główny są wymagane (typ to wymusza).
type NaglowekTelefonu =
  | { phoneHeader?: "close"; phoneCancel?: undefined; phoneSubmit?: undefined }
  | {
      phoneHeader: "actions";
      phoneCancel: { label: string; onClick: () => void };
      phoneSubmit: React.ReactNode;
    };

export function FormDialog({
  open,
  onOpenChange,
  title,
  description,
  wide = false,
  children,
  footer,
  headerAction,
  phoneHeader = "close",
  phoneCancel,
  phoneSubmit,
}: NaglowekTelefonu & {
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
  const akcje = phoneHeader === "actions";
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={`fixed z-50 flex flex-col bg-white text-sm text-foreground outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:max-h-[calc(100%-64px)] ${wide ? "min-[800px]:w-[min(560px,calc(100%-32px))]" : "min-[800px]:w-[min(460px,calc(100%-32px))]"} min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 rounded-xl bg-clip-padding min-[800px]:border min-[800px]:border-border min-[800px]:shadow-pop max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:max-h-[88%] max-[799px]:rounded-t-2xl max-[799px]:rounded-b-none max-[799px]:border max-[799px]:border-b-0 max-[799px]:border-border max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]`}
        >
          {/* Uchwyt arkusza — tylko na telefonie (m-grab z CM-BASE) */}
          <div
            aria-hidden="true"
            className="m-grab flex-none min-[800px]:hidden"
          />
          <div
            className={cn(
              "flex flex-none items-start justify-between gap-3 px-6 pt-6 pb-4 max-[799px]:items-center",
              akcje
                ? "max-[799px]:gap-1 max-[799px]:border-b max-[799px]:border-border max-[799px]:px-3 max-[799px]:pt-1 max-[799px]:pb-2"
                : "max-[799px]:gap-0 max-[799px]:py-2 max-[799px]:pr-2 max-[799px]:pl-5",
            )}
          >
            {/* „Anuluj” (btng, muted) — tylko na telefonie w nagłówku „actions” */}
            {akcje && phoneCancel && (
              <Button
                type="button"
                variant="ghost"
                onClick={phoneCancel.onClick}
                className="flex-none text-muted-foreground min-[800px]:hidden"
              >
                {phoneCancel.label}
              </Button>
            )}
            <div className={cn(akcje && "max-[799px]:min-w-0 max-[799px]:flex-1 max-[799px]:text-center", !akcje && "max-[799px]:flex-1")}>
              <Dialog.Title className={cn("m-0 text-lg leading-[1.3] font-semibold max-[799px]:flex max-[799px]:h-11 max-[799px]:items-center max-[799px]:text-lg", akcje && "max-[799px]:justify-center")}>
                {title}
              </Dialog.Title>
              {description && (
                <Dialog.Description className="m-0 mt-1 text-sm text-muted-foreground max-[799px]:hidden">
                  {description}
                </Dialog.Description>
              )}
            </div>
            {/* ✕ jak .btng.ic.sm z makiet: 28 px bez ramki; na telefonie cel 44 px (ukryty w nagłówku „actions”) */}
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="sm"
                icon
                aria-label="Zamknij"
                className={cn("max-[799px]:size-11", akcje && "max-[799px]:hidden")}
              >
                <XIcon aria-hidden="true" className="size-4 max-[799px]:size-5" />
              </Button>
            </Dialog.Close>
            {headerAction && (
              <div className="flex-none">
                {headerAction}
              </div>
            )}
            {akcje && phoneSubmit && (
              <div className="flex-none min-[800px]:hidden">{phoneSubmit}</div>
            )}
          </div>
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-6 pb-5",
              akcje
                ? "max-[799px]:gap-[18px] max-[799px]:pt-4 max-[799px]:pb-[max(20px,env(safe-area-inset-bottom))]"
                : "max-[799px]:px-5 max-[799px]:pt-1",
            )}
          >
            {children}
          </div>
          {footer && (
            <div
              className={cn(
                "flex flex-none flex-wrap items-center justify-end gap-2 border-t border-border bg-black/[.025] px-6 py-4 min-[800px]:rounded-b-[15px] max-[799px]:pb-[max(28px,env(safe-area-inset-bottom))]",
                // Przy nagłówku „actions” telefon nie ma stopki (przycisk główny jest w nagłówku)
                akcje && "max-[799px]:hidden",
              )}
            >
              {footer}
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
