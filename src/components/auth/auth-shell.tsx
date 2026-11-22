import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { RhytmLogo } from "@/components/brand/rhytm-logo";
import { Button, Card, StatusBadge } from "@/components/controls";
import { cn } from "@/lib/utils";

// Wspólny układ ekranów konta.
// Od 800 px: tło panel (#fafafa) bez siatki, nagłówek z logo i akcją, karta na środku (CLogin.dc.html).
// Poniżej 800 px: białe tło, bez karty, logo nad treścią (MLogin.dc.html).
// Przełączanie wyłącznie klasami CSS — bez matchMedia, żeby hydratacja nie migotała.
export function AuthShell({
  headerAction,
  headerNote,
  footer,
  progress,
  phoneBack,
  children,
}: {
  headerAction?: { href: string; label: string };
  // Web: szara odznaka po prawej zamiast akcji, np. „krok 1 / 3” (CForgot.dc.html)
  headerNote?: string;
  // Web: szary pasek stopki na dole karty (.foot z CForgot / CEmailConfirmed)
  footer?: ReactNode;
  // Web: segmenty postępu nad kartą (CForgot); aria-hidden — krok mówi headerNote
  progress?: { step: number; total: number };
  // Telefon: zamiast logo nagłówek ze strzałką „Wstecz” (MRegister.dc.html)
  phoneBack?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-white text-sm leading-[1.21] text-foreground min-[800px]:bg-panel">
      <header className="flex items-center justify-between px-6 py-4 max-[799px]:hidden">
        <RhytmLogo size={24} withWordmark className="gap-2" />
        {headerAction && (
          <Button asChild variant="secondary" size="md">
            <Link href={headerAction.href}>{headerAction.label}</Link>
          </Button>
        )}
        {headerNote && (
          <StatusBadge tone="gray" size="lg" className="tabular-nums">
            {headerNote}
          </StatusBadge>
        )}
      </header>

      {phoneBack && (
        <header className="box-border flex min-h-[60px] flex-none items-center gap-1 p-2 min-[800px]:hidden">
          <Link
            href={phoneBack}
            aria-label="Wstecz"
            className="inline-flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted"
          >
            <ChevronLeft
              aria-hidden="true"
              className="size-[22px]"
              strokeWidth={2}
            />
          </Link>
        </header>
      )}

      <main className="flex flex-1 items-center justify-center p-6 max-[799px]:items-stretch max-[799px]:p-0">
        <div className="flex w-full flex-col gap-3 max-[799px]:flex-1 min-[800px]:max-w-[400px]">
          {progress && (
            <div
              data-testid="auth-progress"
              aria-hidden="true"
              className="flex gap-1 max-[799px]:hidden"
            >
              {Array.from({ length: progress.total }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    i < progress.step ? "bg-foreground" : "bg-border",
                  )}
                />
              ))}
            </div>
          )}
          <Card
            className={cn(
              "box-border w-full gap-4 px-6 py-7",
              // Telefon: bez karty, marginesy z makiety (56 / 24 / 24 px)
              "max-[799px]:flex-1 max-[799px]:gap-0 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:px-6 max-[799px]:pb-6 max-[799px]:shadow-none",
              phoneBack ? "max-[799px]:pt-2" : "max-[799px]:pt-14",
            )}
          >
            {!phoneBack && (
              <RhytmLogo
                size={48}
                className="mb-3.5 justify-center min-[800px]:hidden"
              />
            )}
            {children}
            {footer && (
              <div className="-mx-6 -mb-7 flex items-center justify-center rounded-b-[15px] border-t border-border bg-black/[.025] px-6 py-3.5 text-center text-[13px] text-muted-foreground max-[799px]:mx-0 max-[799px]:mb-0 max-[799px]:mt-4 max-[799px]:rounded-none max-[799px]:border-0 max-[799px]:bg-transparent max-[799px]:p-0">
                {footer}
              </div>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
