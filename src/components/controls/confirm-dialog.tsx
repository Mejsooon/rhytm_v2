"use client";

import * as React from "react";
import { Trash2Icon } from "lucide-react";
import { Dialog } from "radix-ui";

import { cn } from "@/lib/utils";
import { Button } from "./button";

// Jedno okno potwierdzenia (role="alertdialog") wg S2DeleteBlockDialog.dc.html (od 800 px: karta .dlg 400 px)
// i CMDeleteBlock.dc.html (poniżej 800 px: arkusz od dołu z uchwytem m-grab, tytuł 20 px, przyciski w kolumnie:
// potwierdzenie na górze, „Anuluj” pod nim, oba 48 px). Przełączanie wyłącznie klasami CSS.
// Nie obejmuje okna zakresu (scope-dialog.tsx) ani resetu sejfu (vault-reset-dialog.tsx) — mają inny układ.
// W trakcie `pending` Esc i klik w tło nie zamykają okna.
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  error,
  confirmLabel,
  onConfirm,
  pending = false,
  cancelLabel = "Anuluj",
  destructive = true,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  // Dodatkowa treść pod opisem (np. uwaga o zadaniach bloku)
  children?: React.ReactNode;
  // Komunikat błędu z serwera, pod nagłówkiem (role="alert")
  error?: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  pending?: boolean;
  cancelLabel?: string;
  destructive?: boolean;
}) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(otwarte) => !pending && onOpenChange(otwarte)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/[.32] backdrop-blur-[4px] max-[799px]:backdrop-blur-none" />
        <Dialog.Content
          role="alertdialog"
          {...(description ? {} : { "aria-describedby": undefined })}
          className="fixed z-50 flex flex-col bg-white bg-clip-padding text-sm text-foreground outline-none min-[800px]:top-1/2 min-[800px]:left-1/2 min-[800px]:w-[min(400px,calc(100%-32px))] min-[800px]:-translate-x-1/2 min-[800px]:-translate-y-1/2 min-[800px]:rounded-xl min-[800px]:border min-[800px]:border-border min-[800px]:shadow-pop max-[799px]:inset-x-0 max-[799px]:bottom-0 max-[799px]:max-h-[88%] max-[799px]:gap-3.5 max-[799px]:overflow-auto max-[799px]:rounded-t-2xl max-[799px]:rounded-b-none max-[799px]:px-4 max-[799px]:pb-5 max-[799px]:shadow-[0_-8px_30px_rgba(0,0,0,.12)]"
        >
          {/* Uchwyt arkusza — tylko na telefonie (m-grab z CM-BASE) */}
          <div
            aria-hidden="true"
            className="m-grab flex-none min-[800px]:hidden"
          />
          {/* .dlg-h: na webie dolny odstęp 20 px (z błędem pod spodem 16 px) */}
          <div
            className={cn(
              "max-[799px]:pt-1 min-[800px]:px-6 min-[800px]:pt-6",
              error ? "min-[800px]:pb-4" : "min-[800px]:pb-5",
            )}
          >
            <Dialog.Title className="m-0 text-lg leading-[1.3] font-semibold max-[799px]:text-xl">
              {title}
            </Dialog.Title>
            {description && (
              <Dialog.Description className="m-0 mt-1 text-sm text-muted-foreground max-[799px]:text-[13px]">
                {description}
              </Dialog.Description>
            )}
            {children && (
              <div className="mt-2 text-sm text-muted-foreground max-[799px]:text-[13px]">
                {children}
              </div>
            )}
          </div>
          {error && (
            <p
              role="alert"
              className="m-0 text-xs text-destructive-foreground min-[800px]:px-6 min-[800px]:pb-4"
            >
              {error}
            </p>
          )}
          {/* Web: stopka .dlg-f na szarym tle; telefon: dwa pełne przyciski 48 px w kolumnie */}
          <div className="flex justify-end gap-2 max-[799px]:flex-col-reverse max-[799px]:gap-2.5 min-[800px]:rounded-b-[15px] min-[800px]:border-t min-[800px]:border-border min-[800px]:bg-black/[.025] min-[800px]:px-6 min-[800px]:py-4">
            <Button
              variant="ghost"
              className="max-[799px]:h-12"
              disabled={pending}
              onClick={() => onOpenChange(false)}
            >
              {cancelLabel}
            </Button>
            <Button
              variant={destructive ? "destructive" : "primary"}
              className="max-[799px]:h-12"
              disabled={pending}
              onClick={() => void onConfirm()}
            >
              {destructive && (
                <Trash2Icon aria-hidden="true" className="size-4 max-[799px]:hidden" />
              )}
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
