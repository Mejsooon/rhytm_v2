import Link from "next/link";
import { Search } from "lucide-react";

import { Button, Kbd } from "@/components/controls";
import { AppShell } from "@/components/shell/app-shell";

// 404 wg CNotFound.dc.html. Poza grupą (app), więc powłokę dokładamy sami —
// tylko dla zalogowanego (requireUser=false: gość widzi samą treść).
// Nagłówek to .topbar + .crumb z makiety (jak ModuleHeader, ale z <nav>,
// bo ModuleHeader dawałby drugie <h1> obok tytułu 404).
export default function NotFound() {
  return (
    <AppShell requireUser={false}>
      <header className="box-content flex min-h-9 flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-2.5">
        <nav
          aria-label="Okruszki"
          className="flex items-center gap-1.5 text-sm text-muted-foreground"
        >
          <span>rhytm</span>
          <span aria-hidden="true">/</span>
          <b aria-current="page" className="font-medium text-foreground">
            404
          </b>
        </nav>
      </header>
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="flex max-w-[440px] flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="text-[64px] leading-none font-semibold tracking-[-0.04em] text-foreground tabular-nums">
            404
          </span>
          <h1 className="m-0 mt-2 text-[22px] font-semibold tracking-[-0.015em]">
            Tej strony nie ma
          </h1>
          <p className="m-0 leading-normal text-muted-foreground">
            Mogła zostać usunięta albo link jest niepełny. Strony usunięte w
            ciągu 30 dni możesz przywrócić z{" "}
            <Link
              href="/ustawienia/kosz"
              className="text-foreground underline underline-offset-2"
            >
              kosza
            </Link>
            .
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild variant="primary" size="md">
              <Link href="/dzis">Wróć do Dziś</Link>
            </Button>
            {/* Wyszukiwarka ⌘K dojdzie w kolejnych etapach */}
            <Button
              variant="secondary"
              size="md"
              aria-disabled="true"
              className="cursor-default"
            >
              <Search size={16} aria-hidden="true" />
              Szukaj <Kbd>⌘K</Kbd>
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
